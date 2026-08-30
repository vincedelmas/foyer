import {resolve} from "node:path";
import {and, eq, inArray} from "drizzle-orm";
import {lstat, realpath, unlink} from "node:fs/promises";
import {db, ensureDatabase} from "@/server/db/index.server";
import {compareMediaParts} from "@/server/media/media-part-sort";
import {isPathInsideRoot} from "@/server/media/file-utils.server";
import {removeTvCompatibilityCache} from "@/server/media/tv-cache.server";
import {libraries, mediaItems, type MediaPartRow, mediaParts, type SubtitleRow, subtitleTracks} from "@/server/db/schema";
import type {MediaDeleteResult, MediaExternalSubtitleInfo, MediaFileInfo, MediaInfo, MediaStreamInfo, MediaStreamType} from "@ploux/contracts";


interface FfprobeStream {
    index?: number,
    width?: number,
    height?: number,
    profile?: string,
    channels?: number,
    codec_name?: string,
    codec_type?: string,
    sample_rate?: string,
    r_frame_rate?: string,
    channel_layout?: string,
    codec_long_name?: string,
    tags?: {
        title?: string,
        language?: string,
    },
}


interface FfprobeOutput {
    streams?: FfprobeStream[],
    format?: {
        duration?: string,
        bit_rate?: string,
        format_name?: string,
    },
}


interface ProbeResult {
    available: boolean
    error: string | null
    bitRate: number | null
    formatName: string | null
    streams: MediaStreamInfo[]
    durationSeconds: number | null
}


const ffprobeTimeoutMs = 10_000;
const probeCache = new Map<string, Promise<ProbeResult>>();


const numberOrNull = (value: string | number | undefined) => {
    if (value === undefined) return null;

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}


const frameRateOrNull = (value: string | undefined) => {
    if (!value) return null;

    const [numerator, denominator] = value.split("/").map(Number);
    if (!numerator || !denominator) {
        return numberOrNull(value);
    }

    return Math.round((numerator / denominator) * 100) / 100;
}


const streamType = (value: string | undefined): MediaStreamType => {
    if (value === "video" || value === "audio" || value === "subtitle") {
        return value;
    }

    return "other";
}


const probeFile = async (filePath: string): Promise<ProbeResult> => {
    let process: ReturnType<typeof Bun.spawn>;

    try {
        process = Bun.spawn(
            ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", filePath],
            { stdout: "pipe", stderr: "ignore" },
        )
    }
    catch {
        return {
            streams: [],
            bitRate: null,
            available: false,
            formatName: null,
            durationSeconds: null,
            error: "ffprobe is not installed; showing indexed file information only.",
        }
    }

    let timedOut = false;
    const timeout = setTimeout(() => {
        timedOut = true;
        process.kill("SIGKILL");
    }, ffprobeTimeoutMs);

    const [stdout, exitCode] = await Promise
        .all([
            new Response(process.stdout as ReadableStream<Uint8Array>).text(),
            process.exited,
        ])
        .finally(() => clearTimeout(timeout));

    if (timedOut) {
        return {
            streams: [],
            bitRate: null,
            available: true,
            formatName: null,
            durationSeconds: null,
            error: "ffprobe timed out while inspecting this file.",
        }
    }

    if (exitCode !== 0) {
        return {
            streams: [],
            bitRate: null,
            available: true,
            formatName: null,
            durationSeconds: null,
            error: "ffprobe could not inspect this file.",
        }
    }

    let output: FfprobeOutput;
    try {
        output = JSON.parse(stdout) as FfprobeOutput;
    }
    catch {
        return {
            streams: [],
            bitRate: null,
            available: true,
            formatName: null,
            durationSeconds: null,
            error: "ffprobe returned unreadable stream information.",
        };
    }

    return {
        error: null,
        available: true,
        formatName: output.format?.format_name ?? null,
        bitRate: numberOrNull(output.format?.bit_rate),
        durationSeconds: numberOrNull(output.format?.duration),
        streams: (output.streams ?? []).map((stream): MediaStreamInfo => ({
            index: stream.index ?? 0,
            profile: stream.profile ?? null,
            codec: stream.codec_name ?? null,
            title: stream.tags?.title ?? null,
            width: numberOrNull(stream.width),
            height: numberOrNull(stream.height),
            type: streamType(stream.codec_type),
            language: stream.tags?.language ?? null,
            channels: numberOrNull(stream.channels),
            channelLayout: stream.channel_layout ?? null,
            sampleRate: numberOrNull(stream.sample_rate),
            frameRate: frameRateOrNull(stream.r_frame_rate),
            codecDescription: stream.codec_long_name ?? null,
        })),
    };
};


const externalSubtitleInfo = (subtitle: SubtitleRow): MediaExternalSubtitleInfo => {
    return {
        id: subtitle.id,
        label: subtitle.label,
        path: subtitle.filePath,
        format: subtitle.format,
        language: subtitle.language,
        isDefault: subtitle.isDefault,
    };
};


const mediaFileInfo = (part: MediaPartRow, subtitles: SubtitleRow[], probe?: ProbeResult): MediaFileInfo => {
    return {
        id: part.id,
        size: part.size,
        path: part.filePath,
        mimeType: part.mimeType,
        fileName: part.fileName,
        container: part.container,
        modifiedAt: part.modifiedAt,
        streams: probe?.streams ?? [],
        bitRate: probe?.bitRate ?? null,
        probeError: probe?.error ?? null,
        formatName: probe?.formatName ?? null,
        probeAvailable: probe?.available ?? null,
        durationSeconds: probe?.durationSeconds ?? null,
        externalSubtitles: subtitles.map(externalSubtitleInfo),
    };
};


const probePart = (part: MediaPartRow) => {
    const key = `${part.id}:${part.size}:${part.modifiedAt}`;
    const cached = probeCache.get(key);

    if (cached) return cached;

    const pending = probeFile(part.filePath).catch((error) => {
        probeCache.delete(key);
        throw error;
    })

    probeCache.set(key, pending);

    return pending;
}


export const getMediaInfo = async (mediaId: string): Promise<MediaInfo | null> => {
    ensureDatabase();

    const item = db
        .select({ id: mediaItems.id, title: mediaItems.title })
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get();

    if (!item) return null;

    const parts = db
        .select()
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all()
        .sort(compareMediaParts);

    const partIds = parts.map((part) => part.id);
    const subtitlesByPart = new Map<string, MediaExternalSubtitleInfo[]>();

    const subtitles = partIds.length > 0
        ? db.select().from(subtitleTracks).where(inArray(subtitleTracks.mediaPartId, partIds)).all()
        : [];

    for (const subtitle of subtitles) {
        const bucket = subtitlesByPart.get(subtitle.mediaPartId) ?? [];
        bucket.push(externalSubtitleInfo(subtitle));
        subtitlesByPart.set(subtitle.mediaPartId, bucket);
    }

    const files = parts.map((part): MediaFileInfo => ({
        ...mediaFileInfo(part, []),
        externalSubtitles: subtitlesByPart.get(part.id) ?? [],
    }))

    return {
        files,
        id: item.id,
        title: item.title,
        totalSize: files.reduce((total, file) => total + file.size, 0),
    };
};


export const getMediaFileInfo = async (mediaId: string, partId: string): Promise<MediaFileInfo> => {
    ensureDatabase();

    const part = db
        .select()
        .from(mediaParts)
        .where(and(eq(mediaParts.id, partId), eq(mediaParts.mediaItemId, mediaId)))
        .get();

    if (!part) throw new Error("Media file not found");

    const subtitles = db
        .select()
        .from(subtitleTracks)
        .where(eq(subtitleTracks.mediaPartId, partId))
        .all();

    return mediaFileInfo(part, subtitles, await probePart(part));
}


const isNotFoundError = (error: unknown) => {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}


export const deleteMediaFiles = async (mediaId: string): Promise<MediaDeleteResult> => {
    ensureDatabase();

    const item = db
        .select({ id: mediaItems.id, libraryId: mediaItems.libraryId })
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get();

    if (!item) throw new Error("Media item not found");

    const library = db
        .select({ path: libraries.path })
        .from(libraries)
        .where(eq(libraries.id, item.libraryId))
        .get();

    if (!library) throw new Error("Media folder not found");

    const parts = db
        .select({ id: mediaParts.id, filePath: mediaParts.filePath })
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all();

    const partIds = new Set(parts.map((part) => part.id));

    const subtitlePaths = db
        .select({ mediaPartId: subtitleTracks.mediaPartId, filePath: subtitleTracks.filePath })
        .from(subtitleTracks)
        .all()
        .filter((subtitle) => partIds.has(subtitle.mediaPartId))
        .map((subtitle) => subtitle.filePath);

    const targets = [...new Set([
        ...subtitlePaths,
        ...parts.map((part) => part.filePath),
    ])];

    let filesAlreadyMissing = 0;
    const existingTargets: string[] = [];
    const configuredRoot = resolve(library.path);
    const resolvedRoot = await realpath(configuredRoot).catch(() => configuredRoot);

    for (const targetPath of targets) {
        const resolvedTarget = resolve(targetPath);

        if (!isPathInsideRoot(configuredRoot, resolvedTarget)) {
            throw new Error("Refusing to delete a file outside the media folder");
        }

        try {
            const fileStat = await lstat(resolvedTarget)
            if (!fileStat.isFile()) {
                throw new Error("Refusing to delete a media path that is not a regular file");
            }

            const realTarget = await realpath(resolvedTarget)
            if (!isPathInsideRoot(resolvedRoot, realTarget)) {
                throw new Error("Refusing to delete a file outside the media folder");
            }

            existingTargets.push(realTarget);
        }
        catch (error) {
            if (isNotFoundError(error)) {
                filesAlreadyMissing += 1;
                continue;
            }
            throw error;
        }
    }

    await removeTvCompatibilityCache(partIds);

    for (const targetPath of existingTargets) {
        await unlink(targetPath);
    }

    db.delete(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .run();

    return {
        mediaId,
        filesAlreadyMissing,
        filesDeleted: existingTargets.length,
    };
};

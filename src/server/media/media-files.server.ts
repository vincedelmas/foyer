import type {
    MediaDeleteResult,
    MediaExternalSubtitleInfo,
    MediaFileInfo,
    MediaInfo,
    MediaStreamInfo,
    MediaStreamType,
} from "@ploux/contracts"
import {eq} from "drizzle-orm"
import {lstat, realpath, unlink} from "node:fs/promises"
import {resolve} from "node:path"
import {db, ensureDatabase} from "@/server/db/index.server"
import {libraries, mediaItems, mediaParts, subtitleTracks} from "@/server/db/schema"
import {isPathInsideRoot} from "@/server/media/file-utils.server"
import {removeTvCompatibilityCache} from "@/server/media/tv-cache.server"


interface FfprobeStream {
    index?: number
    codec_name?: string
    codec_long_name?: string
    codec_type?: string
    profile?: string
    width?: number
    height?: number
    r_frame_rate?: string
    channels?: number
    channel_layout?: string
    sample_rate?: string
    tags?: {
        language?: string
        title?: string
    }
}


interface FfprobeOutput {
    streams?: FfprobeStream[]
    format?: {
        format_name?: string
        duration?: string
        bit_rate?: string
    }
}


interface ProbeResult {
    available: boolean
    formatName: string | null
    durationSeconds: number | null
    bitRate: number | null
    streams: MediaStreamInfo[]
    error: string | null
}


const numberOrNull = (value: string | number | undefined) => {
    if (value === undefined) return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}


const frameRateOrNull = (value: string | undefined) => {
    if (!value) return null
    const [numerator, denominator] = value.split("/").map(Number)
    if (!numerator || !denominator) return numberOrNull(value)
    return Math.round((numerator / denominator) * 100) / 100
}


const streamType = (value: string | undefined): MediaStreamType => {
    if (value === "video" || value === "audio" || value === "subtitle") return value
    return "other"
}


const probeFile = async (filePath: string): Promise<ProbeResult> => {
    let process: ReturnType<typeof Bun.spawn>
    try {
        process = Bun.spawn(
            ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", filePath],
            {stdout: "pipe", stderr: "ignore"}
        )
    }
    catch {
        return {
            available: false,
            formatName: null,
            durationSeconds: null,
            bitRate: null,
            streams: [],
            error: "ffprobe is not installed; showing indexed file information only.",
        }
    }

    const [stdout, exitCode] = await Promise.all([
        new Response(process.stdout as ReadableStream<Uint8Array>).text(),
        process.exited,
    ])

    if (exitCode !== 0) {
        return {
            available: true,
            formatName: null,
            durationSeconds: null,
            bitRate: null,
            streams: [],
            error: "ffprobe could not inspect this file.",
        }
    }

    let output: FfprobeOutput
    try {
        output = JSON.parse(stdout) as FfprobeOutput
    }
    catch {
        return {
            available: true,
            formatName: null,
            durationSeconds: null,
            bitRate: null,
            streams: [],
            error: "ffprobe returned unreadable stream information.",
        }
    }

    return {
        available: true,
        formatName: output.format?.format_name ?? null,
        durationSeconds: numberOrNull(output.format?.duration),
        bitRate: numberOrNull(output.format?.bit_rate),
        streams: (output.streams ?? []).map((stream): MediaStreamInfo => ({
            index: stream.index ?? 0,
            type: streamType(stream.codec_type),
            codec: stream.codec_name ?? null,
            codecDescription: stream.codec_long_name ?? null,
            profile: stream.profile ?? null,
            language: stream.tags?.language ?? null,
            title: stream.tags?.title ?? null,
            width: numberOrNull(stream.width),
            height: numberOrNull(stream.height),
            frameRate: frameRateOrNull(stream.r_frame_rate),
            channels: numberOrNull(stream.channels),
            channelLayout: stream.channel_layout ?? null,
            sampleRate: numberOrNull(stream.sample_rate),
        })),
        error: null,
    }
}


export const getMediaInfo = async (mediaId: string): Promise<MediaInfo | null> => {
    ensureDatabase()

    const item = db
        .select({id: mediaItems.id, title: mediaItems.title})
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get()

    if (!item) return null

    const parts = db
        .select()
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all()
        .sort((left, right) =>
            (left.seasonNumber ?? 0) - (right.seasonNumber ?? 0) ||
            (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0) ||
            left.fileName.localeCompare(right.fileName)
        )
    const partIds = new Set(parts.map((part) => part.id))
    const subtitlesByPart = new Map<string, MediaExternalSubtitleInfo[]>()

    for (const subtitle of db.select().from(subtitleTracks).all()) {
        if (!partIds.has(subtitle.mediaPartId)) continue
        const bucket = subtitlesByPart.get(subtitle.mediaPartId) ?? []
        bucket.push({
            id: subtitle.id,
            path: subtitle.filePath,
            format: subtitle.format,
            language: subtitle.language,
            label: subtitle.label,
            isDefault: subtitle.isDefault,
        })
        subtitlesByPart.set(subtitle.mediaPartId, bucket)
    }

    let canProbe = true
    let probeAvailable = true
    const files: MediaFileInfo[] = []
    for (const part of parts) {
        const probe = canProbe
            ? await probeFile(part.filePath)
            : {
                available: false,
                formatName: null,
                durationSeconds: null,
                bitRate: null,
                streams: [],
                error: "ffprobe is not installed; showing indexed file information only.",
            }
        if (!probe.available) {
            canProbe = false
            probeAvailable = false
        }

        files.push({
            id: part.id,
            fileName: part.fileName,
            path: part.filePath,
            container: part.container,
            mimeType: part.mimeType,
            size: part.size,
            modifiedAt: part.modifiedAt,
            formatName: probe.formatName,
            durationSeconds: probe.durationSeconds,
            bitRate: probe.bitRate,
            streams: probe.streams,
            externalSubtitles: subtitlesByPart.get(part.id) ?? [],
            probeError: probe.error,
        })
    }

    return {
        id: item.id,
        title: item.title,
        totalSize: files.reduce((total, file) => total + file.size, 0),
        probeAvailable: files.length > 0 && probeAvailable,
        files,
    }
}


const isNotFoundError = (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"


export const deleteMediaFiles = async (mediaId: string): Promise<MediaDeleteResult> => {
    ensureDatabase()

    const item = db
        .select({id: mediaItems.id, libraryId: mediaItems.libraryId})
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get()

    if (!item) throw new Error("Media item not found")

    const library = db
        .select({path: libraries.path})
        .from(libraries)
        .where(eq(libraries.id, item.libraryId))
        .get()

    if (!library) throw new Error("Media folder not found")

    const parts = db
        .select({id: mediaParts.id, filePath: mediaParts.filePath})
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all()
    const partIds = new Set(parts.map((part) => part.id))
    const subtitlePaths = db
        .select({mediaPartId: subtitleTracks.mediaPartId, filePath: subtitleTracks.filePath})
        .from(subtitleTracks)
        .all()
        .filter((subtitle) => partIds.has(subtitle.mediaPartId))
        .map((subtitle) => subtitle.filePath)
    const targets = [...new Set([
        ...subtitlePaths,
        ...parts.map((part) => part.filePath),
    ])]
    const configuredRoot = resolve(library.path)
    const resolvedRoot = await realpath(configuredRoot).catch(() => configuredRoot)
    const existingTargets: string[] = []
    let filesAlreadyMissing = 0

    for (const targetPath of targets) {
        const resolvedTarget = resolve(targetPath)
        if (!isPathInsideRoot(configuredRoot, resolvedTarget)) {
            throw new Error("Refusing to delete a file outside the media folder")
        }

        try {
            const fileStat = await lstat(resolvedTarget)
            if (!fileStat.isFile()) {
                throw new Error("Refusing to delete a media path that is not a regular file")
            }
            const realTarget = await realpath(resolvedTarget)
            if (!isPathInsideRoot(resolvedRoot, realTarget)) {
                throw new Error("Refusing to delete a file outside the media folder")
            }
            existingTargets.push(realTarget)
        }
        catch (error) {
            if (isNotFoundError(error)) {
                filesAlreadyMissing += 1
                continue
            }
            throw error
        }
    }

    await removeTvCompatibilityCache(partIds)
    for (const targetPath of existingTargets) await unlink(targetPath)
    db.delete(mediaItems).where(eq(mediaItems.id, mediaId)).run()

    return {
        mediaId,
        filesDeleted: existingTargets.length,
        filesAlreadyMissing,
    }
}

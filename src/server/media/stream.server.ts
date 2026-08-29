import {randomUUID} from "node:crypto";
import {mkdir, readFile, rename, rm, stat} from "node:fs/promises";
import {resolve} from "node:path";
import {corsHeaders} from "@/server/http.server";
import {subtitleForClient} from "@/server/media/subtitles.server.ts";
import {getPartFile, getSubtitleFile} from "@/server/media/repository.server.ts";
import {tvCompatibilityCacheDirectory} from "@/server/media/tv-cache.server.ts";


const baseHeaders = (mimeType: string, size: number, fileName: string) => ({
    ...corsHeaders(),
    "Accept-Ranges": "bytes",
    "Content-Type": mimeType,
    "Content-Length": String(size),
    "Cache-Control": "private, max-age=0, must-revalidate",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
});


type StreamSource = {
    file: ReturnType<typeof Bun.file>
    size: number
    mimeType: string
    fileName: string
}

const unavailableFileResponse = (status: 404 | 500, message: string) =>
    new Response(message, {
        status,
        headers: {
            ...corsHeaders(),
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
        },
    })

const streamSource = async (
    filePath: string,
    mimeType: string,
    fileName: string
): Promise<StreamSource | Response> => {
    try {
        const fileStat = await stat(filePath)
        if (!fileStat.isFile()) {
            return unavailableFileResponse(
                404,
                "Media file is no longer available. Rescan the collection to update Ploux."
            )
        }

        return {
            file: Bun.file(filePath),
            size: fileStat.size,
            mimeType,
            fileName,
        }
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error.code === "ENOENT" || error.code === "ENOTDIR")
        ) {
            return unavailableFileResponse(
                404,
                "Media file is no longer available. Rescan the collection to update Ploux."
            )
        }

        console.error(`Could not access media file ${filePath}`, error)
        return unavailableFileResponse(500, "Could not access the media file.")
    }
}

const remuxJobs = new Map<string, Promise<string | null>>()

const remuxForAndroidTv = async (
    part: NonNullable<ReturnType<typeof getPartFile>>
) => {
    const cacheKey = `${part.id}-${part.size}-${part.modifiedAt}`
    const cachedPath = resolve(tvCompatibilityCacheDirectory, `${cacheKey}.mkv`)
    if (await Bun.file(cachedPath).exists()) return cachedPath

    const existing = remuxJobs.get(cacheKey)
    if (existing) return existing

    const job = (async () => {
        await mkdir(tvCompatibilityCacheDirectory, {recursive: true})
        const temporaryPath = resolve(
            tvCompatibilityCacheDirectory,
            `${cacheKey}.${randomUUID()}.tmp.mkv`
        )
        try {
            const process = Bun.spawn(
                [
                    "ffmpeg",
                    "-v",
                    "error",
                    "-fflags",
                    "+genpts",
                    "-y",
                    "-i",
                    part.filePath,
                    "-map",
                    "0:v:0",
                    "-map",
                    "0:a?",
                    "-c",
                    "copy",
                    "-avoid_negative_ts",
                    "make_zero",
                    temporaryPath,
                ],
                {stdout: "ignore", stderr: "pipe"}
            )
            const stderr = await new Response(process.stderr).text()
            const exitCode = await process.exited
            if (exitCode !== 0) {
                console.warn(
                    `Could not prepare Android TV stream for ${part.fileName}: ${stderr.trim() || `ffmpeg exited with ${exitCode}`}`
                )
                return null
            }
            await rename(temporaryPath, cachedPath)
            return cachedPath
        } catch (error) {
            console.warn(
                `Could not prepare Android TV stream for ${part.fileName}: ${error instanceof Error ? error.message : String(error)}`
            )
            return null
        } finally {
            await rm(temporaryPath, {force: true})
        }
    })().finally(() => remuxJobs.delete(cacheKey))

    remuxJobs.set(cacheKey, job)
    return job
}

const respondWithFile = (
    request: Request,
    source: StreamSource,
    head: boolean
) => {
    const {file, size, mimeType, fileName} = source
    const range = request.headers.get("range");

    if (!range) {
        return new Response(head ? null : file, {
            status: 200,
            headers: baseHeaders(mimeType, size, fileName),
        });
    }

    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
        return new Response(null, {
            status: 416,
            headers: { ...corsHeaders(), "Content-Range": `bytes */${size}` },
        });
    }

    const suffixLength = !match[1] && match[2] ? Number(match[2]) : null
    const start = suffixLength
        ? Math.max(0, size - suffixLength)
        : Number(match[1] || 0)
    const end = Math.min(
        match[2] && match[1] ? Number(match[2]) : size - 1,
        size - 1
    )
    if (start < 0 || end < start || start >= size) {
        return new Response(null, {
            status: 416,
            headers: { ...corsHeaders(), "Content-Range": `bytes */${size}` },
        })
    }

    const length = end - start + 1
    return new Response(head ? null : file.slice(start, end + 1), {
        status: 206,
        headers: {
            ...baseHeaders(mimeType, length, fileName),
            "Content-Range": `bytes ${start}-${end}/${size}`,
        },
    })
}

export const streamPart = async (request: Request, partId: string, head = false) => {
    const part = getPartFile(partId);
    if (!part) {
        return new Response("Media part not found", { status: 404, headers: corsHeaders() });
    }

    const source = await streamSource(part.filePath, part.mimeType, part.fileName)
    if (source instanceof Response) return source

    if (
        new URL(request.url).searchParams.get("compat") === "android-tv" &&
        part.container === "avi"
    ) {
        const remuxedPath = await remuxForAndroidTv(part)
        if (remuxedPath) {
            const file = Bun.file(remuxedPath)
            return respondWithFile(
                request,
                {
                    file,
                    size: file.size,
                    mimeType: "video/x-matroska",
                    fileName: `${part.fileName.replace(/\.avi$/i, "")}.mkv`,
                },
                head
            )
        }
    }

    return respondWithFile(
        request,
        source,
        head
    )
};


export const streamSubtitle = async (request: Request, subtitleId: string) => {
    const subtitle = getSubtitleFile(subtitleId)
    if (!subtitle) {
        return new Response("Subtitle not found", {
            status: 404,
            headers: corsHeaders(),
        })
    }
    const source = await readFile(subtitle.filePath, "utf8")
    const preserveAssFormatting =
        new URL(request.url).searchParams.get("compat") === "android-tv" &&
        (subtitle.format === "ass" || subtitle.format === "ssa")
    const payload = subtitleForClient(
        source,
        subtitle.format,
        preserveAssFormatting
    )
    return new Response(payload.body, {
        headers: {
            ...corsHeaders(),
            "Content-Type": payload.contentType,
            "Cache-Control": "private, max-age=3600",
        },
    })
};

import { readFile } from "node:fs/promises"

import { corsHeaders } from "@/server/http.server"
import { getPartFile, getSubtitleFile } from "./repository.server"
import { subtitleToVtt } from "./subtitles.server"

const baseHeaders = (mimeType: string, size: number, fileName: string) => ({
  ...corsHeaders(),
  "Accept-Ranges": "bytes",
  "Content-Type": mimeType,
  "Content-Length": String(size),
  "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  "Cache-Control": "private, max-age=0, must-revalidate",
})

export const streamPart = (request: Request, partId: string, head = false) => {
  const part = getPartFile(partId)
  if (!part)
    return new Response("Media part not found", {
      status: 404,
      headers: corsHeaders(),
    })
  const file = Bun.file(part.filePath)
  const size = part.size
  const range = request.headers.get("range")

  if (!range) {
    return new Response(head ? null : file, {
      status: 200,
      headers: baseHeaders(part.mimeType, size, part.fileName),
    })
  }

  const match = range.match(/^bytes=(\d*)-(\d*)$/)
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: { ...corsHeaders(), "Content-Range": `bytes */${size}` },
    })
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
      ...baseHeaders(part.mimeType, length, part.fileName),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  })
}

export const streamSubtitle = async (subtitleId: string) => {
  const subtitle = getSubtitleFile(subtitleId)
  if (!subtitle) {
    return new Response("Subtitle not found", {
      status: 404,
      headers: corsHeaders(),
    })
  }
  const source = await readFile(subtitle.filePath, "utf8")
  const vtt = subtitleToVtt(source, subtitle.format)
  return new Response(vtt, {
    headers: {
      ...corsHeaders(),
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  })
}

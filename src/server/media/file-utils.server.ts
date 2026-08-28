import { createHash } from "node:crypto"
import { extname, isAbsolute, parse, relative, resolve, sep } from "node:path"

const videoExtensions = new Set([
  ".mp4",
  ".m4v",
  ".webm",
  ".mkv",
  ".avi",
  ".mov",
  ".ts",
  ".m2ts",
  ".ogv",
])

const subtitleExtensions = new Set([".srt", ".vtt", ".ass", ".ssa"])

const mimeTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".ts": "video/mp2t",
  ".m2ts": "video/mp2t",
  ".ogv": "video/ogg",
}

export const extensionOf = (filePath: string) => extname(filePath).toLowerCase()
export const isVideo = (filePath: string) =>
  videoExtensions.has(extensionOf(filePath))
export const isSubtitle = (filePath: string) =>
  subtitleExtensions.has(extensionOf(filePath))
export const mimeTypeFor = (filePath: string) =>
  mimeTypes[extensionOf(filePath)] ?? "application/octet-stream"

export const isPathInsideRoot = (rootPath: string, targetPath: string) => {
  const relativePath = relative(resolve(rootPath), resolve(targetPath))
  return (
    Boolean(relativePath) &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  )
}

export const stableId = (...parts: string[]) =>
  createHash("sha1").update(parts.join("\u0000")).digest("hex").slice(0, 24)

export const normalizeTitle = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[._]+/g, " ")
    .replace(/\[[^\]]*]|\([^)]*(?:rip|codec|dub|sub|bluray|web)[^)]*\)/gi, " ")
    .replace(
      /\b(?:2160p|1080p|720p|480p|4k|uhd|bluray|brrip|webrip|web-dl|hdtv|x26[45]|hevc|av1|aac|dts|remux)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()

export const inferYear = (value: string) => {
  const match = value.match(/(?:^|\D)((?:18|19|20|21)\d{2})(?:\D|$)/)
  return match?.[1] ? Number(match[1]) : null
}

export const cleanMovieTitle = (filePath: string) => {
  const raw = parse(filePath).name
  const year = inferYear(raw)
  const beforeYear = year ? raw.slice(0, raw.indexOf(String(year))) : raw
  return { title: normalizeTitle(beforeYear) || normalizeTitle(raw), year }
}

export const inferEpisode = (filePath: string) => {
  const raw = parse(filePath).name
  const standard = raw.match(/\bS(\d{1,2})[ ._-]*E(\d{1,3})(?:[ ._-]+(.*))?/i)
  if (standard) {
    return {
      seasonNumber: Number(standard[1]),
      episodeNumber: Number(standard[2]),
      title: normalizeTitle(standard[3] ?? "") || null,
    }
  }

  const alternate = raw.match(/\b(\d{1,2})x(\d{1,3})(?:[ ._-]+(.*))?/i)
  if (alternate) {
    return {
      seasonNumber: Number(alternate[1]),
      episodeNumber: Number(alternate[2]),
      title: normalizeTitle(alternate[3] ?? "") || null,
    }
  }

  const anime = raw.match(/(?:^|\s-\s|\[)(\d{1,3})(?:v\d)?(?:\]|\s|$)/i)
  if (anime) {
    return {
      seasonNumber: 1,
      episodeNumber: Number(anime[1]),
      title: null,
    }
  }

  return null
}

const languageNames: Record<string, string> = {
  en: "English",
  eng: "English",
  fr: "Français",
  fre: "Français",
  fra: "Français",
  es: "Español",
  spa: "Español",
  de: "Deutsch",
  ger: "Deutsch",
  deu: "Deutsch",
  it: "Italiano",
  ja: "日本語",
  jpn: "日本語",
  und: "Subtitles",
}

export const subtitleLanguage = (subtitlePath: string, videoPath: string) => {
  const subtitleName = parse(subtitlePath).name
  const videoName = parse(videoPath).name
  const suffix = subtitleName.slice(videoName.length).replace(/^[._ -]+/, "")
  const code = suffix.split(/[._ -]/)[0]?.toLowerCase() || "und"
  const normalized = code === "forced" || code === "default" ? "und" : code
  return {
    language: normalized,
    label: languageNames[normalized] ?? normalized.toUpperCase(),
    isDefault: /(?:^|[._ -])default(?:$|[._ -])/i.test(subtitleName),
  }
}

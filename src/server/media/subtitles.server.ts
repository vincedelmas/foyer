const toTimestamp = (value: string) => {
  const normalized = value.trim().replace(",", ".")
  const parts = normalized.split(":")
  const hours = parts.length === 3 ? (parts[0] ?? "0") : "0"
  const minutes = parts.length === 3 ? (parts[1] ?? "0") : (parts[0] ?? "0")
  const secondsWithFraction = parts.at(-1) ?? "0"
  const [seconds, fraction = "000"] = secondsWithFraction.split(".")
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${(seconds ?? "0").padStart(2, "0")}.${fraction.padEnd(3, "0").slice(0, 3)}`
}

const stripAssMarkup = (value: string) =>
  value
    .replace(/\{[^}]*}/g, "")
    .replace(/\\N/gi, "\n")
    .replace(/\\h/gi, " ")

const assToVtt = (source: string) => {
  const cues = source
    .split(/\r?\n/)
    .filter((line) => line.startsWith("Dialogue:"))
    .map((line) => {
      const columns = line.slice("Dialogue:".length).split(",")
      const start = columns[1]
      const end = columns[2]
      const text = columns.slice(9).join(",")
      if (!start || !end || !text) return null
      return `${toTimestamp(start)} --> ${toTimestamp(end)}\n${stripAssMarkup(text)}`
    })
    .filter(Boolean)
  return `WEBVTT\n\n${cues.join("\n\n")}\n`
}

export const subtitleToVtt = (source: string, format: string) => {
  const clean = source.replace(/^\uFEFF/, "")
  if (format === "vtt")
    return clean.startsWith("WEBVTT") ? clean : `WEBVTT\n\n${clean}`
  if (format === "ass" || format === "ssa") return assToVtt(clean)

  const cues = clean
    .replace(/\r/g, "")
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n")
      const timingIndex = lines.findIndex((line) => line.includes("-->"))
      if (timingIndex < 0) return null
      const timing = lines[timingIndex]
        .split("-->")
        .map(toTimestamp)
        .join(" --> ")
      const text = lines.slice(timingIndex + 1).join("\n")
      return `${timing}\n${text}`
    })
    .filter(Boolean)

  return `WEBVTT\n\n${cues.join("\n\n")}\n`
}

export const subtitleForClient = (
  source: string,
  format: string,
  preserveAssFormatting: boolean
) => {
  if (preserveAssFormatting && (format === "ass" || format === "ssa")) {
    return {
      body: source.replace(/^\uFEFF/, ""),
      contentType: "text/x-ssa; charset=utf-8",
    }
  }

  return {
    body: subtitleToVtt(source, format),
    contentType: "text/vtt; charset=utf-8",
  }
}

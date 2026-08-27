import { describe, expect, it } from "vitest"

import { subtitleToVtt } from "./subtitles.server"

describe("subtitle conversion", () => {
  it("converts SRT timestamps to browser-compatible WebVTT", () => {
    const result = subtitleToVtt(
      "1\r\n00:00:01,250 --> 00:00:03,500\r\nHello there.\r\n",
      "srt"
    )
    expect(result).toContain("WEBVTT")
    expect(result).toContain("00:00:01.250 --> 00:00:03.500")
    expect(result).toContain("Hello there.")
  })

  it("converts basic ASS dialogue and strips presentation markup", () => {
    const result = subtitleToVtt(
      "[Events]\nDialogue: 0,0:00:02.10,0:00:04.50,Default,,0,0,0,,{\\i1}Hello\\Nworld",
      "ass"
    )
    expect(result).toContain("00:00:02.100 --> 00:00:04.500")
    expect(result).toContain("Hello\nworld")
    expect(result).not.toContain("{\\i1}")
  })

  it("preserves an existing WebVTT header", () => {
    expect(
      subtitleToVtt("WEBVTT\n\n00:01.000 --> 00:02.000\nHi", "vtt")
    ).toMatch(/^WEBVTT/)
  })
})

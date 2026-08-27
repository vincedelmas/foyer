import { describe, expect, it } from "vitest"

import {
  cleanMovieTitle,
  inferEpisode,
  mimeTypeFor,
  subtitleLanguage,
} from "./file-utils.server"

describe("media filename inference", () => {
  it("extracts a movie title and year from common release naming", () => {
    expect(
      cleanMovieTitle("/media/Dune.Part.Two.2024.2160p.WEB-DL.mkv")
    ).toEqual({
      title: "Dune Part Two",
      year: 2024,
    })
  })

  it("extracts standard and alternate episode numbers", () => {
    expect(inferEpisode("The Bear S03E04 Violet.mp4")).toEqual({
      seasonNumber: 3,
      episodeNumber: 4,
      title: "Violet",
    })
    expect(inferEpisode("Show.2x11.Finale.mkv")).toEqual({
      seasonNumber: 2,
      episodeNumber: 11,
      title: "Finale",
    })
  })

  it("recognizes anime episode numbers and subtitle languages", () => {
    expect(inferEpisode("Frieren - 08 [1080p].mkv")?.episodeNumber).toBe(8)
    expect(
      subtitleLanguage(
        "/anime/Frieren - 08 [1080p].fr.default.srt",
        "/anime/Frieren - 08 [1080p].mkv"
      )
    ).toEqual({ language: "fr", label: "Français", isDefault: true })
  })

  it("uses direct-play MIME types without changing the file", () => {
    expect(mimeTypeFor("movie.mp4")).toBe("video/mp4")
    expect(mimeTypeFor("movie.mkv")).toBe("video/x-matroska")
  })
})

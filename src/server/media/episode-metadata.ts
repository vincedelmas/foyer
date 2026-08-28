export interface LocalEpisodePart {
    id: string
    seasonNumber: number | null
    episodeNumber: number | null
}

export interface EpisodeTitleMetadata {
    seasonNumber: number
    episodeNumber: number
    title: string
}

export const matchLocalEpisodeTitles = (
    parts: LocalEpisodePart[],
    metadata: EpisodeTitleMetadata[]
) => {
    const titleByEpisode = new Map(
        metadata.map((episode) => [
            `${episode.seasonNumber}:${episode.episodeNumber}`,
            episode.title.trim(),
        ])
    )

    return parts.flatMap((part) => {
        if (part.seasonNumber === null || part.episodeNumber === null) return []
        const title = titleByEpisode.get(
            `${part.seasonNumber}:${part.episodeNumber}`
        )
        return title ? [{partId: part.id, title}] : []
    })
}

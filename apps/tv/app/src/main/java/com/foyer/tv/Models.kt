package com.foyer.tv

import kotlinx.serialization.Serializable

// JSON names mirror packages/contracts/src/index.ts. The server remains the source of truth.
@Serializable
data class Progress(
    val updatedAt: Long,
    val percentage: Double,
    val completed: Boolean,
    val positionSeconds: Double,
    val durationSeconds: Double,
)

@Serializable
data class Subtitle(
    val id: String,
    val url: String,
    val label: String,
    val format: String,
    val language: String,
    val isDefault: Boolean,
)

@Serializable
data class Part(
    val id: String,
    val size: Long,
    val fileName: String,
    val mimeType: String,
    val streamUrl: String,
    val title: String?,
    val subtitles: List<Subtitle>,
    val seasonNumber: Int?,
    val episodeNumber: Int?,
    val progress: Progress?,
) {
    val displayTitle: String
        get() =
            title
                ?: if (seasonNumber != null && episodeNumber != null) {
                    "S%02dE%02d".format(seasonNumber, episodeNumber)
                } else fileName
}

@Serializable
data class Person(val id: Int, val name: String, val character: String, val profilePath: String?)

@Serializable
data class Season(
    val id: Int,
    val name: String,
    val seasonNumber: Int,
    val episodeCount: Int,
    val airDate: String?,
    val posterPath: String?,
)

@Serializable
data class Media(
    val id: String,
    val title: String,
    val addedAt: Long,
    val kind: String,
    val watched: Boolean,
    val partCount: Int,
    val unwatchedPartCount: Int? = null,
    val year: Int?,
    val hasProgress: Boolean,
    val overview: String?,
    val nextPartId: String?,
    val nextPartTitle: String?,
    val posterPath: String?,
    val releaseDate: String?,
    val backdropPath: String?,
    val nextPartSeasonNumber: Int?,
    val nextPartEpisodeNumber: Int?,
    val tmdbVoteCount: Int?,
    val runtimeMinutes: Int?,
    val tmdbVoteAverage: Double?,
    val progress: Progress?,
    val metadataStatus: String,
    // Detail-only fields are absent on collection and currently-watching responses.
    val genres: List<String> = emptyList(),
    val parts: List<Part> = emptyList(),
    val cast: List<Person> = emptyList(),
    val tmdbId: Int? = null,
    val partSeasons: List<Int> = emptyList(),
    val watchedSeasons: List<Int> = emptyList(),
    val seasons: List<Season> = emptyList(),
    val partsPagination: Pagination? = null,
    val originalTitle: String? = null,
    val contentRating: String? = null,
    val originalLanguage: String? = null,
    val selectedPartSeason: Int? = null,
    val metadataRefreshedAt: Long? = null,
) {
    val runtimeLabel: String?
        get() = runtimeMinutes?.let {
            if (it >= 60) "${it / 60}h ${it % 60}m" else "${it}m"
        }
}

@Serializable
data class Collection(
    val id: String,
    val name: String,
    val path: String,
    val kind: String,
    val titleCount: Int = 0,
    val posterPaths: List<String> = emptyList(),
)

@Serializable
data class Pagination(val page: Int, val pageSize: Int, val totalItems: Int, val totalPages: Int)

@Serializable
data class Stats(
    val anime: Int,
    val titles: Int,
    val movies: Int,
    val series: Int,
    val unmatched: Int,
    val inProgress: Int,
)

@Serializable
data class Library(val stats: Stats, val items: List<Media>, val pagination: Pagination)

@Serializable
data class Scan(
    val id: String,
    val startedAt: Long,
    val filesSeen: Int,
    val titlesAdded: Int,
    val error: String?,
    val subtitlesFound: Int,
    val libraryId: String?,
    val completedAt: Long?,
    val status: String,
)

@Serializable data class Settings(val libraries: List<Collection>, val scans: List<Scan>)

@Serializable data class ScanResult(val scans: List<Scan>)

@Serializable
data class Candidate(
    val id: Int,
    val title: String,
    val overview: String,
    val popularity: Double,
    val year: Int?,
    val kind: String,
    val originalTitle: String,
    val posterPath: String?,
)

@Serializable data class Candidates(val candidates: List<Candidate>)

@Serializable
data class Stream(
    val index: Int,
    val codec: String?,
    val title: String?,
    val width: Int?,
    val type: String,
    val height: Int?,
    val profile: String?,
    val language: String?,
    val channels: Int?,
    val frameRate: Double?,
    val sampleRate: Int?,
    val channelLayout: String?,
    val codecDescription: String?,
)

@Serializable
data class ExternalSubtitle(
    val id: String,
    val path: String,
    val label: String,
    val format: String,
    val language: String,
    val isDefault: Boolean,
)

@Serializable
data class MediaFile(
    val id: String,
    val path: String,
    val size: Long,
    val fileName: String,
    val mimeType: String,
    val container: String,
    val modifiedAt: Long,
    val bitRate: Long?,
    val formatName: String?,
    val probeError: String?,
    val streams: List<Stream>,
    val probeAvailable: Boolean?,
    val durationSeconds: Double?,
    val externalSubtitles: List<ExternalSubtitle>,
)

@Serializable
data class MediaInfo(
    val id: String,
    val title: String,
    val totalSize: Long,
    val files: List<MediaFile>,
)

@Serializable
data class Health(
    val directPlay: Boolean,
    val transcoding: Boolean,
    val status: String,
    val name: String,
    val version: String,
)

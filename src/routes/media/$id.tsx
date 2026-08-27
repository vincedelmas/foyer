import type {MediaPart} from "@ploux/contracts"
import {formatRuntime, tmdbImage} from "@ploux/contracts"
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {createFileRoute, Link} from "@tanstack/react-router"
import {CalendarIcon, CheckCircle2Icon, Clock3Icon, PlayIcon, RefreshCwIcon,} from "lucide-react"
import {AppHeader} from "@/components/app-header"
import {IdentifyDialog} from "@/components/identify-dialog"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Separator} from "@/components/ui/separator"
import {Skeleton} from "@/components/ui/skeleton"
import {Spinner} from "@/components/ui/spinner"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs"
import {toast} from "@/components/ui/toast"
import {api} from "@/lib/api"


export const Route = createFileRoute("/media/$id")({
    component: MediaDetailsPage,
})


function MediaDetailsPage() {
    const { id } = Route.useParams()
    const queryClient = useQueryClient()
    const media = useQuery({
        queryKey: ["media", id],
        queryFn: () => api.media(id),
    })
    const refresh = useMutation({
        mutationFn: () => api.refreshMetadata(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["media", id] })
            await queryClient.invalidateQueries({ queryKey: ["library"] })
            toast.add({ title: "Metadata refreshed", type: "success" })
        },
        onError: (error) =>
            toast.add({
                title: "Refresh failed",
                description: error.message,
                type: "error",
            }),
    })

    if (media.isPending) return <DetailsSkeleton/>
    if (media.isError) {
        return (
            <div className="min-h-svh">
                <AppHeader/>
                <main className="mx-auto max-w-3xl px-6 py-24 text-center">
                    <h1 className="font-heading text-4xl">Could not open this title</h1>
                    <p className="mt-3 text-muted-foreground">{media.error.message}</p>
                </main>
            </div>
        )
    }

    const item = media.data
    const backdrop = tmdbImage(item.backdropPath, "original")
    const poster = tmdbImage(item.posterPath, "w500")
    const seasons = item.parts.reduce((grouped, part) => {
        const season = part.seasonNumber ?? 1
        const bucket = grouped.get(season) ?? []
        bucket.push(part)
        grouped.set(season, bucket)
        return grouped
    }, new Map<number, MediaPart[]>())

    return (
        <div className="min-h-svh">
            <AppHeader/>
            <main>
                <section className="relative min-h-[38rem] overflow-hidden">
                    {backdrop ? (
                        <img
                            src={backdrop}
                            alt=""
                            className="absolute inset-0 size-full object-cover opacity-65"
                        />
                    ) : null}
                    <div className="cinema-fade-side absolute inset-0"/>
                    <div className="cinema-fade absolute inset-x-0 bottom-0 h-3/4"/>
                    <div
                        className="relative mx-auto grid min-h-[38rem] max-w-[100rem] items-end gap-8 px-4 pb-12 sm:px-6 md:grid-cols-[13rem_1fr] lg:px-10 xl:grid-cols-[16rem_1fr]">
                        <div className="poster-shadow hidden aspect-[2/3] overflow-hidden rounded-xl bg-muted ring-1 ring-border md:block">
                            {poster ? (
                                <img
                                    src={poster}
                                    alt={`Poster for ${item.title}`}
                                    className="size-full object-cover"
                                />
                            ) : null}
                        </div>
                        <div
                            data-archive-item
                            className="flex max-w-4xl flex-col items-start gap-5"
                        >
                            <div className="flex flex-wrap gap-2">
                                <Badge>
                                    {item.kind === "movie"
                                        ? "Movie"
                                        : item.kind === "anime"
                                            ? "Anime"
                                            : "Series"}
                                </Badge>
                                {item.contentRating ? (
                                    <Badge variant="outline">{item.contentRating}</Badge>
                                ) : null}
                                {item.metadataStatus === "unmatched" ? (
                                    <Badge variant="secondary">Needs identification</Badge>
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-3">
                                <h1 className="font-heading text-5xl leading-[0.95] font-medium tracking-tight text-balance sm:text-7xl xl:text-8xl">
                                    {item.title}
                                </h1>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                    {item.year ? (
                                        <span className="flex items-center gap-1.5">
                      <CalendarIcon className="size-4"/>
                                            {item.year}
                    </span>
                                    ) : null}
                                    {item.runtimeMinutes ? (
                                        <span className="flex items-center gap-1.5">
                      <Clock3Icon className="size-4"/>
                                            {formatRuntime(item.runtimeMinutes)}
                    </span>
                                    ) : null}
                                    <span>
                    {item.parts.length}{" "}
                                        {item.parts.length === 1 ? "file" : "episodes"}
                  </span>
                                </div>
                            </div>
                            {item.overview ? (
                                <p className="max-w-3xl text-sm leading-7 text-foreground/80 sm:text-base">
                                    {item.overview}
                                </p>
                            ) : null}
                            <div className="flex flex-wrap gap-3">
                                {item.nextPartId ? (
                                    <Button
                                        size="lg"
                                        render={
                                            <Link
                                                to="/watch/$mediaId/$partId"
                                                params={{ mediaId: item.id, partId: item.nextPartId }}
                                            />
                                        }
                                        nativeButton={false}
                                    >
                                        <PlayIcon
                                            data-icon="inline-start"
                                            className="fill-current"
                                        />
                                        {item.progress?.positionSeconds
                                            ? `Resume · ${item.progress.percentage}%`
                                            : "Play now"}
                                    </Button>
                                ) : null}
                                <IdentifyDialog media={item}/>
                                <Button
                                    variant="ghost"
                                    onClick={() => refresh.mutate()}
                                    disabled={refresh.isPending || !item.tmdbId}
                                >
                                    {refresh.isPending ? (
                                        <Spinner data-icon="inline-start"/>
                                    ) : (
                                        <RefreshCwIcon data-icon="inline-start"/>
                                    )}
                                    Refresh metadata
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="mx-auto flex max-w-[100rem] flex-col gap-14 px-4 pb-20 sm:px-6 lg:px-10">
                    <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]">
                        <div className="flex flex-col gap-5">
                            <h2 className="font-heading text-3xl font-medium">
                                {item.kind === "movie" ? "Playback" : "Episodes"}
                            </h2>
                            {item.kind === "movie" ? (
                                <EpisodeList mediaId={item.id} parts={item.parts}/>
                            ) : (
                                <Tabs defaultValue={String([...seasons.keys()][0] ?? 1)}>
                                    <TabsList
                                        variant="line"
                                        className="max-w-full overflow-x-auto"
                                    >
                                        {[...seasons.keys()].map((season) => (
                                            <TabsTrigger key={season} value={String(season)}>
                                                Season {season}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    {[...seasons.entries()].map(([season, parts]) => (
                                        <TabsContent
                                            key={season}
                                            value={String(season)}
                                            className="pt-3"
                                        >
                                            <EpisodeList mediaId={item.id} parts={parts}/>
                                        </TabsContent>
                                    ))}
                                </Tabs>
                            )}
                        </div>
                        <aside className="flex flex-col gap-5">
                            <h2 className="font-heading text-3xl font-medium">Details</h2>
                            <dl className="flex flex-col gap-3 text-sm">
                                <DetailRow term="Original title" value={item.originalTitle}/>
                                <DetailRow
                                    term="Language"
                                    value={item.originalLanguage?.toUpperCase()}
                                />
                                <DetailRow term="Genres" value={item.genres.join(", ")}/>
                                <DetailRow
                                    term="TMDB"
                                    value={item.tmdbId ? `#${item.tmdbId}` : "Not matched"}
                                />
                            </dl>
                        </aside>
                    </section>

                    {item.cast.length ? (
                        <section className="flex flex-col gap-6">
                            <h2 className="font-heading text-3xl font-medium">Cast</h2>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
                                {item.cast.map((person) => (
                                    <div
                                        key={person.id}
                                        className="flex min-w-0 items-center gap-3"
                                    >
                                        <Avatar className="size-11 shrink-0">
                                            <AvatarImage
                                                src={tmdbImage(person.profilePath, "w342") ?? undefined}
                                                alt=""
                                            />
                                            <AvatarFallback>
                                                {person.name
                                                    .split(" ")
                                                    .map((word) => word[0])
                                                    .join("")
                                                    .slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {person.name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {person.character || "Cast"}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            </main>
        </div>
    )
}

function EpisodeList({
                         mediaId,
                         parts,
                     }: {
    mediaId: string
    parts: MediaPart[]
}) {
    return (
        <div className="overflow-hidden rounded-xl border bg-card/50">
            {parts.map((part, index) => (
                <div key={part.id}>
                    {index ? <Separator/> : null}
                    <div className="flex items-center gap-4 p-4 sm:p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
              {part.episodeNumber ?? index + 1}
            </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                                {part.title ||
                                    (part.episodeNumber
                                        ? `Episode ${part.episodeNumber}`
                                        : "Feature")}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                {part.fileName} · {formatBytes(part.size)}
                            </p>
                        </div>
                        {part.progress?.completed ? (
                            <CheckCircle2Icon
                                className="size-5 shrink-0 text-primary"
                                aria-label="Watched"
                            />
                        ) : null}
                        <Button
                            variant="outline"
                            size="sm"
                            render={
                                <Link
                                    to="/watch/$mediaId/$partId"
                                    params={{ mediaId, partId: part.id }}
                                />
                            }
                            nativeButton={false}
                        >
                            <PlayIcon data-icon="inline-start"/>
                            {part.progress?.positionSeconds && !part.progress.completed
                                ? "Resume"
                                : "Play"}
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}

function DetailRow({
                       term,
                       value,
                   }: {
    term: string
    value: string | null | undefined
}) {
    if (!value) return null
    return (
        <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-border pb-3">
            <dt className="text-muted-foreground">{term}</dt>
            <dd>{value}</dd>
        </div>
    )
}

function formatBytes(bytes: number) {
    const units = ["B", "KB", "MB", "GB", "TB"]
    let value = bytes
    let unit = 0
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024
        unit += 1
    }
    return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`
}

function DetailsSkeleton() {
    return (
        <div className="min-h-svh">
            <AppHeader/>
            <main className="mx-auto grid min-h-[38rem] max-w-[100rem] items-end gap-8 px-6 py-16 md:grid-cols-[13rem_1fr]">
                <Skeleton className="hidden aspect-[2/3] w-full rounded-xl md:block"/>
                <div className="flex max-w-3xl flex-col gap-5">
                    <Skeleton className="h-6 w-28"/>
                    <Skeleton className="h-20 w-4/5"/>
                    <Skeleton className="h-4 w-48"/>
                    <Skeleton className="h-24 w-full"/>
                    <Skeleton className="h-10 w-48"/>
                </div>
            </main>
        </div>
    )
}

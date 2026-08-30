import {z} from "zod";
import {cn} from "@/lib/utils";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {mediaOptions} from "@/lib/query-options";
import {AppHeader} from "@/components/app-header";
import {Separator} from "@/components/ui/separator";
import {ScrollArea} from "@/components/ui/scroll-area";
import {useSuspenseQuery} from "@tanstack/react-query";
import {IdentifyDialog} from "@/components/identify-dialog";
import {createFileRoute, Link} from "@tanstack/react-router";
import {MediaPagination} from "@/components/media-pagination";
import {WatchToggleButton} from "@/components/watch-toggle-button";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {formatBytes, formatRuntime, MediaPart, tmdbImage} from "@foyer/contracts";
import {CalendarIcon, Clock3Icon, PlayIcon, RefreshCwIcon, StarIcon} from "lucide-react";
import {useRefreshMediaMetadataMutation, useSetMediaPartWatchedMutation} from "@/lib/query-mutations";


const searchSchema = z.object({
    page: z.coerce.number().int().min(1).optional().catch(1),
    season: z.coerce.number().int().min(0).optional().catch(undefined),
});


export const Route = createFileRoute("/media/$id")({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    context: ({ params: { id }, deps: { search } }) => ({
        mediaQueryOptions: mediaOptions(id, { season: search.season, page: search.page, pageSize: 50 }),
    }),
    loader: ({ context }) => {
        return context.queryClient.query(context.mediaQueryOptions);
    },
    component: MediaDetailsPage,
});


function MediaDetailsPage() {
    const { id } = Route.useParams();
    const navigate = Route.useNavigate();
    const { mediaQueryOptions } = Route.useRouteContext();

    const refresh = useRefreshMediaMetadataMutation(id);
    const item = useSuspenseQuery(mediaQueryOptions).data;

    const poster = tmdbImage(item.posterPath, "w500");
    const backdrop = tmdbImage(item.backdropPath, "original");

    const showPartList = item.kind !== "movie" || item.partCount > 1;
    const selectedSeason = item.selectedPartSeason ?? item.partSeasons[0] ?? 1;
    const tmdbRating = formatTmdbRating(item.tmdbVoteAverage, item.tmdbVoteCount);

    const changeEpisodePage = (page: number) => {
        void navigate({ search: (previous) => ({ ...previous, season: selectedSeason, page }) });
    };

    const episodePageHref = (page: number) => {
        const query = new URLSearchParams({ season: String(selectedSeason) });
        if (page > 1) query.set("page", String(page));
        return `/media/${encodeURIComponent(id)}?${query}`;
    };

    return (
        <div className="min-h-svh">
            <AppHeader/>
            <main>
                <section className="relative min-h-38rem overflow-hidden">
                    {backdrop &&
                        <img
                            alt=""
                            src={backdrop}
                            className="absolute inset-0 size-full object-cover opacity-65"
                        />
                    }

                    <div className="cinema-fade-side absolute inset-0"/>
                    <div className="cinema-fade absolute inset-x-0 bottom-0 h-3/4"/>

                    <div className="relative mx-auto grid min-h-38rem max-w-[100rem] items-end gap-8 px-4 pb-12 sm:px-6
                    md:grid-cols-[13rem_1fr] lg:px-10 xl:grid-cols-[16rem_1fr]">
                        <div className="poster-shadow hidden aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-border md:block">
                            {poster &&
                                <img
                                    src={poster}
                                    alt={`Poster for ${item.title}`}
                                    className="size-full object-cover"
                                />
                            }
                        </div>
                        <div data-archive-item className="flex max-w-4xl flex-col items-start gap-5">
                            <div className="flex flex-wrap gap-2">
                                <Badge>
                                    {item.kind === "movie" ? "Movie" : "TV show"}
                                </Badge>
                                {item.contentRating &&
                                    <Badge variant="outline">
                                        PEGI {item.contentRating}
                                    </Badge>
                                }
                                {item.metadataStatus === "unmatched" &&
                                    <Badge variant="secondary">
                                        Needs identification
                                    </Badge>
                                }
                            </div>
                            <div className="flex flex-col gap-5">
                                <h1 className="font-heading text-5xl leading-[0.95] font-medium tracking-tight text-balance sm:text-7xl xl:text-8xl">
                                    {item.title}
                                </h1>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                    {item.year &&
                                        <span className="flex items-center gap-1.5">
                                            <CalendarIcon className="size-4"/>
                                            {item.year}
                                        </span>
                                    }
                                    {item.runtimeMinutes &&
                                        <span className="flex items-center gap-1.5">
                                            <Clock3Icon className="size-4"/>
                                            {formatRuntime(item.runtimeMinutes)}
                                        </span>
                                    }
                                    {tmdbRating &&
                                        <span className="flex items-center gap-1.5">
                                            <StarIcon className="size-4 fill-current text-rating"/>
                                            {tmdbRating}
                                        </span>
                                    }
                                    <span>
                                        {item.partCount}{" "}
                                        {item.kind === "movie"
                                            ? item.partCount === 1 ? "file" : "files"
                                            : item.partCount === 1 ? "episode" : "episodes"}
                                    </span>
                                </div>
                            </div>
                            {item.overview &&
                                <p className="max-w-3xl text-sm leading-7 text-foreground/80 sm:text-base">
                                    {item.overview}
                                </p>
                            }
                            <div className="flex flex-wrap gap-3">
                                {item.nextPartId &&
                                    <Button
                                        size="lg"
                                        nativeButton={false}
                                        render={<Link to="/watch/$mediaId/$partId" params={{ mediaId: item.id, partId: item.nextPartId }}/>}
                                    >
                                        <PlayIcon data-icon="inline-start" className="fill-current"/>

                                        {item.progress?.positionSeconds && !item.progress.completed && !item.watched
                                            ? `Resume · ${item.progress.percentage}%`
                                            : "Play"
                                        }
                                    </Button>
                                }

                                <IdentifyDialog
                                    media={item}
                                />

                                <Button variant="ghost" onClick={() => refresh.mutate()} disabled={refresh.isPending || !item.tmdbId}>
                                    {refresh.isPending
                                        ? <Spinner data-icon="inline-start"/>
                                        : <RefreshCwIcon data-icon="inline-start"/>
                                    }
                                    Refresh metadata
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="mx-auto flex max-w-[100rem] flex-col gap-14 px-4 pb-20 sm:px-6 lg:px-10">
                    <section className={cn("grid gap-8", showPartList ? "lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]" : "max-w-2xl")}>
                        {showPartList &&
                            <div className="flex flex-col gap-5">
                                <h2 className="font-heading text-3xl font-medium">
                                    {item.kind === "movie" ? "Files" : "Episodes"}
                                </h2>
                                {item.kind === "movie" ?
                                    <EpisodeList
                                        mediaId={item.id}
                                        parts={item.parts}
                                        fallbackLabel="Part"
                                        startIndex={(item.partsPagination.page - 1) * item.partsPagination.pageSize}
                                    />
                                    :
                                    <Tabs
                                        value={String(selectedSeason)}
                                        onValueChange={(value) => {
                                            void navigate({ resetScroll: false, search: { season: Number(value), page: 1 } });
                                        }}
                                    >
                                        <div className="max-w-full overflow-x-auto overflow-y-hidden pb-1.5 scrollbar-none
                                        [&::-webkit-scrollbar]:hidden">
                                            <TabsList variant="line">
                                                {item.partSeasons.map((season) =>
                                                    <TabsTrigger key={season} value={String(season)}>
                                                        Season {season}
                                                    </TabsTrigger>
                                                )}
                                            </TabsList>
                                        </div>
                                        <TabsContent value={String(selectedSeason)} className="pt-3">
                                            <EpisodeList
                                                mediaId={item.id}
                                                parts={item.parts}
                                                fallbackLabel="Episode"
                                                startIndex={(item.partsPagination.page - 1) * item.partsPagination.pageSize}
                                            />
                                        </TabsContent>
                                    </Tabs>
                                }
                                {!!item.partsPagination.totalItems &&
                                    <MediaPagination
                                        hrefForPage={episodePageHref}
                                        onPageChange={changeEpisodePage}
                                        pagination={item.partsPagination}
                                        itemLabel={item.kind === "movie" ? "files" : "episodes"}
                                    />
                                }
                            </div>
                        }
                        <aside className="flex flex-col gap-5">
                            <h2 className="font-heading text-3xl font-medium">
                                Details
                            </h2>
                            <dl className="flex flex-col gap-3 text-sm">
                                <DetailRow
                                    term="Original title"
                                    value={item.originalTitle}
                                />
                                <DetailRow
                                    term="Language"
                                    value={item.originalLanguage?.toUpperCase()}
                                />
                                <DetailRow
                                    term="Genres"
                                    value={item.genres.join(", ")}
                                />
                                <DetailRow
                                    term="TMDB"
                                    value={item.tmdbId ? `#${item.tmdbId}` : "Not matched"}
                                />
                            </dl>
                        </aside>
                    </section>

                    {item.cast.length &&
                        <section className="flex flex-col gap-6">
                            <h2 className="font-heading text-3xl font-medium">
                                Cast
                            </h2>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
                                {item.cast.map((person) =>
                                    <div key={person.id} className="flex min-w-0 items-center gap-3">
                                        <Avatar className="size-11 shrink-0">
                                            <AvatarImage
                                                alt=""
                                                src={tmdbImage(person.profilePath, "w342") ?? undefined}
                                            />
                                            <AvatarFallback>
                                                {person.name
                                                    .split(" ")
                                                    .map((word) => word[0])
                                                    .join("")
                                                    .slice(0, 2)
                                                }
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
                                )}
                            </div>
                        </section>
                    }
                </div>
            </main>
        </div>
    );
}


interface EpisodeListProps {
    mediaId: string;
    parts: MediaPart[];
    startIndex: number;
    fallbackLabel: string;
}


function EpisodeList({ mediaId, parts, fallbackLabel, startIndex }: EpisodeListProps) {
    const rows = (
        <>
            {parts.map((part, idx) =>
                <div key={part.id}>
                    {!!idx && <Separator/>}
                    <div className="flex items-center gap-4 p-4 sm:p-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
                      {part.episodeNumber ?? startIndex + idx + 1}
                    </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                                {part.title || (part.episodeNumber
                                    ? `Episode ${part.episodeNumber}`
                                    : `${fallbackLabel} ${startIndex + idx + 1}`)
                                }
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                {part.fileName} · {formatBytes(part.size)}
                            </p>
                        </div>
                        <EpisodeWatchToggle mediaId={mediaId} part={part}/>
                        <Button
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={<Link to="/watch/$mediaId/$partId" params={{ mediaId, partId: part.id }}/>}
                        >
                            <PlayIcon data-icon="inline-start"/>
                            {part.progress?.positionSeconds && !part.progress.completed
                                ? "Resume"
                                : "Play"
                            }
                        </Button>
                    </div>
                </div>
            )}
        </>
    );

    return (
        parts.length > 8 ?
            <ScrollArea className="h-[min(42rem,70svh)] rounded-xl border bg-card/50">
                {rows}
            </ScrollArea>
            :
            <div className="overflow-hidden rounded-xl border bg-card/50">
                {rows}
            </div>
    );
}


function EpisodeWatchToggle({ mediaId, part }: { mediaId: string, part: MediaPart }) {
    const watched = part.progress?.completed === true;
    const watchState = useSetMediaPartWatchedMutation(mediaId);

    return (
        <WatchToggleButton
            watched={watched}
            pending={watchState.isPending}
            onToggle={() => watchState.mutate({ partId: part.id, watched: !watched })}
            label={watched ? "Mark episode as unwatched" : "Mark episode as watched"}
        />
    );
}


function DetailRow({ term, value }: { term: string, value: string | null | undefined }) {
    if (!value) return null;

    return (
        <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-border pb-3">
            <dt className="text-muted-foreground">
                {term}
            </dt>
            <dd>{value}</dd>
        </div>
    );
}


function formatTmdbRating(voteAverage: number | null, voteCount: number | null) {
    if (voteAverage === null) return null;

    const rating = `${voteAverage.toFixed(1)}/10`;

    if (voteCount === null) return rating;

    return `${rating} · ${new Intl.NumberFormat("en-US").format(voteCount)} votes`;
}

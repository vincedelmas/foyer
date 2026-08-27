import {mediaKindSchema, mediaSortSchema, MediaSummary, tmdbImage} from "@ploux/contracts"
import {useQuery} from "@tanstack/react-query"
import {createFileRoute, Link} from "@tanstack/react-router"
import {ArrowRightIcon, FilmIcon, PlayIcon, SearchIcon} from "lucide-react"
import {z} from "zod"
import {AppHeader} from "@/components/app-header"
import {MediaGrid} from "@/components/media-grid"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {InputGroup, InputGroupAddon, InputGroupInput,} from "@/components/ui/input-group"
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {api} from "@/lib/api"


const searchSchema = z.object({
    kind: mediaKindSchema.optional().catch(undefined),
    search: z.string().optional().catch(undefined),
    sort: mediaSortSchema.optional().catch("recent"),
})

const sortItems = [
    { label: "Recently added", value: "recent" },
    { label: "Title A–Z", value: "title" },
    { label: "Newest year", value: "year" },
    { label: "Unwatched first", value: "unwatched" },
] as const

export const Route = createFileRoute("/")({
    validateSearch: searchSchema,
    component: LibraryPage,
})

function LibraryPage() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    const library = useQuery({
        queryKey: ["library", search],
        queryFn: () => api.library(search),
    })
    const items = library.data?.items ?? []
    const featured = items.find((item) => item.backdropPath) ?? items[0]
    const continueWatching = items.filter(
        (item) =>
            item.progress &&
            item.progress.positionSeconds > 0 &&
            !item.progress.completed
    )
    const sectionTitle = search.search
        ? `Results for “${search.search}”`
        : search.kind === "movie"
            ? "Movies"
            : search.kind === "series"
                ? "Series"
                : search.kind === "anime"
                    ? "Anime"
                    : "The archive"

    const updateSearch = (value: string) => {
        void navigate({
            search: (previous) => ({ ...previous, search: value || undefined }),
            replace: true,
        })
    }

    return (
        <div className="min-h-svh">
            <AppHeader search={search.search} onSearchChange={updateSearch}/>

            <main>
                {!search.kind && !search.search && featured ? (
                    <FeaturedTitle item={featured}/>
                ) : null}

                <div className="mx-auto flex max-w-[100rem] flex-col gap-12 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
                    <InputGroup className="sm:hidden">
                        <InputGroupAddon>
                            <SearchIcon/>
                        </InputGroupAddon>
                        <InputGroupInput
                            aria-label="Search your library"
                            placeholder="Search the archive…"
                            value={search.search ?? ""}
                            onChange={(event) => updateSearch(event.target.value)}
                        />
                    </InputGroup>

                    {!search.kind && !search.search && continueWatching.length ? (
                        <section
                            className="flex flex-col gap-5"
                            aria-labelledby="continue-heading"
                        >
                            <div>
                                <p className="mb-1 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                                    Pick up the thread
                                </p>
                                <h2
                                    id="continue-heading"
                                    className="font-heading text-3xl font-medium"
                                >
                                    Continue watching
                                </h2>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                                {continueWatching.slice(0, 3).map((item) => (
                                    <ContinueCard key={item.id} item={item}/>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section
                        className="flex flex-col gap-6"
                        aria-labelledby="library-heading"
                    >
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                            <div>
                                <p className="mb-1 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                                    {library.data
                                        ? `${library.data.stats.titles} titles at home`
                                        : "Reading the shelves"}
                                </p>
                                <h1
                                    id="library-heading"
                                    className="font-heading text-4xl font-medium tracking-tight sm:text-5xl"
                                >
                                    {sectionTitle}
                                </h1>
                            </div>
                            <Select
                                items={sortItems}
                                value={search.sort ?? "recent"}
                                onValueChange={(value) => {
                                    if (value)
                                        void navigate({
                                            search: (previous) => ({ ...previous, sort: value }),
                                        })
                                }}
                            >
                                <SelectTrigger className="w-44" aria-label="Sort titles">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent alignItemWithTrigger={false} align="end">
                                    <SelectGroup>
                                        {sortItems.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>

                        {library.isPending ? <LibrarySkeleton/> : null}
                        {library.isError ? (
                            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
                                <p className="font-medium">The archive could not be opened.</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {library.error.message}
                                </p>
                            </div>
                        ) : null}
                        {library.data ? <MediaGrid items={items}/> : null}
                    </section>
                </div>
            </main>
        </div>
    )
}

function FeaturedTitle({ item }: { item: MediaSummary }) {
    const backdrop = tmdbImage(item.backdropPath, "original")
    return (
        <section className="relative min-h-[32rem] overflow-hidden lg:min-h-[39rem]">
            {backdrop ? (
                <img
                    src={backdrop}
                    alt=""
                    className="absolute inset-0 size-full object-cover object-center"
                />
            ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,var(--accent),transparent_42%)]"/>
            )}
            <div className="cinema-fade-side absolute inset-0"/>
            <div className="cinema-fade absolute inset-x-0 bottom-0 h-2/3"/>
            <div className="relative mx-auto flex min-h-[32rem] max-w-[100rem] items-end px-4 pb-14 sm:px-6 lg:min-h-[39rem] lg:items-center lg:px-10 lg:pb-0">
                <div
                    data-archive-item
                    className="flex max-w-2xl flex-col items-start gap-5"
                >
                    <Badge variant="secondary">Recently added</Badge>
                    <div className="flex flex-col gap-3">
                        <h1 className="font-heading text-5xl leading-[0.95] font-medium tracking-tight text-balance sm:text-7xl lg:text-8xl">
                            {item.title}
                        </h1>
                        <p className="text-sm font-medium text-muted-foreground">
                            {item.year ?? "Unknown year"} ·{" "}
                            {item.kind === "movie"
                                ? "Movie"
                                : item.kind === "anime"
                                    ? "Anime"
                                    : "Series"}
                        </p>
                    </div>
                    {item.overview ? (
                        <p className="line-clamp-3 max-w-xl text-sm leading-6 text-foreground/80 sm:text-base">
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
                                <PlayIcon data-icon="inline-start" className="fill-current"/>
                                {item.progress?.positionSeconds ? "Resume" : "Play"}
                            </Button>
                        ) : null}
                        <Button
                            size="lg"
                            variant="secondary"
                            render={<Link to="/media/$id" params={{ id: item.id }}/>}
                            nativeButton={false}
                        >
                            Details
                            <ArrowRightIcon data-icon="inline-end"/>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}

function ContinueCard({ item }: { item: MediaSummary }) {
    const backdrop = tmdbImage(item.backdropPath, "w780")
    return (
        <Link
            to="/watch/$mediaId/$partId"
            params={{ mediaId: item.id, partId: item.nextPartId ?? "" }}
            className="group relative aspect-[16/7] overflow-hidden rounded-xl bg-card ring-1 ring-border transition outline-none hover:-translate-y-1 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
            {backdrop ? (
                <img
                    src={backdrop}
                    alt=""
                    className="size-full object-cover transition duration-500 group-hover:scale-105"
                />
            ) : (
                <FilmIcon className="absolute top-1/2 left-1/2 size-9 -translate-1/2 text-muted-foreground"/>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/55 to-transparent"/>
            <div className="absolute inset-0 flex max-w-[70%] flex-col justify-end gap-2 p-5">
                <p className="truncate font-heading text-2xl font-medium">
                    {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                    {item.progress?.percentage ?? 0}% watched
                </p>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full bg-primary"
                        style={{ width: `${item.progress?.percentage ?? 0}%` }}
                    />
                </div>
            </div>
        </Link>
    )
}

function LibrarySkeleton() {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {Array.from({ length: 12 }, (_, index) => (
                <div key={index} className="flex flex-col gap-3">
                    <Skeleton className="aspect-[2/3] w-full rounded-xl"/>
                    <Skeleton className="h-4 w-4/5"/>
                    <Skeleton className="h-3 w-2/5"/>
                </div>
            ))}
        </div>
    )
}

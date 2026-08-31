import {z} from "zod";
import {useEffect, useState} from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {AppHeader} from "@/components/app-header";
import {MediaGrid} from "@/components/media-grid";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {MediaPagination} from "@/components/media-pagination";
import {CollectionActions} from "@/components/media-folder-card";
import {libraryOptions, mediaFoldersOptions} from "@/lib/query-options";
import {InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput} from "@/components/ui/input-group";
import {ArrowLeftIcon, FilmIcon, FolderSearchIcon, SearchIcon, TvIcon, XIcon} from "lucide-react";
import {mediaSortSchema, MediaWatchFilter, mediaWatchFilterSchema} from "@foyer/contracts";
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from "@/components/ui/empty";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";


const searchSchema = z.object({
    search: z.string().optional().catch(undefined),
    sort: mediaSortSchema.optional().catch("recent"),
    watch: mediaWatchFilterSchema.optional().catch("all"),
    page: z.coerce.number().int().min(1).optional().catch(1),
});


export const Route = createFileRoute("/libraries/$id")({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    context: ({ params: { id }, deps: { search } }) => ({
        libraryQueryOptions: libraryOptions(id, search),
        mediaFoldersQueryOptions: mediaFoldersOptions,
    }),
    loader: ({ context }) => Promise.all([
        context.queryClient.query(context.libraryQueryOptions),
        context.queryClient.query(context.mediaFoldersQueryOptions),
    ]),
    component: MediaFolderPage,
});


const sortItems = [
    { label: "Recently added", value: "recent" },
    { label: "Title A–Z", value: "title" },
    { label: "Release date · newest", value: "release-desc" },
    { label: "Release date · oldest", value: "release-asc" },
    { label: "Length · longest", value: "runtime-desc" },
    { label: "Length · shortest", value: "runtime-asc" },
    { label: "TMDB score · highest", value: "rating-desc" },
    { label: "TMDB score · lowest", value: "rating-asc" },
] as const;

const watchItems = [
    { label: "All titles", value: "all" },
    { label: "Watched", value: "watched" },
    { label: "Unwatched", value: "unwatched" },
] as const;

const watchFilterStorageKey = (libraryId: string) => {
    return `foyer.media.watch-filter.${libraryId}`;
};

const readStoredWatchFilter = (libraryId: string) => {
    try {
        return window.localStorage.getItem(watchFilterStorageKey(libraryId));
    }
    catch {
        return null;
    }
};

const storeWatchFilter = (libraryId: string, watch: MediaWatchFilter) => {
    try {
        window.localStorage.setItem(watchFilterStorageKey(libraryId), watch);
    }
    catch {
        return;
    }
};


function MediaFolderPage() {
    const { libraryQueryOptions, mediaFoldersQueryOptions } = Route.useRouteContext();

    const { id } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const library = useSuspenseQuery(libraryQueryOptions).data;
    const folders = useSuspenseQuery(mediaFoldersQueryOptions).data;
    const [searchInput, setSearchInput] = useState(search.search ?? "");

    const folder = folders.find((candidate) => candidate.id === id);
    const TypeIcon = folder?.kind === "series" ? TvIcon : FilmIcon;

    useEffect(() => {
        setSearchInput(search.search ?? "");
    }, [search.search]);

    useEffect(() => {
        if (search.watch) {
            storeWatchFilter(id, search.watch);
            return;
        }

        const storedFilter = readStoredWatchFilter(id);
        if (!storedFilter) return;

        const parsedFilter = mediaWatchFilterSchema.safeParse(storedFilter);
        if (!parsedFilter.success) {
            try {
                window.localStorage.removeItem(watchFilterStorageKey(id));
            }
            catch {
                return;
            }
            return;
        }

        if (parsedFilter.data === "all") return;

        void navigate({
            replace: true,
            resetScroll: false,
            search: (prev) => ({ ...prev, watch: parsedFilter.data, page: 1 }),
        });

    }, [id, navigate, search.watch]);

    useEffect(() => {
        const normalizedSearch = searchInput.trim();
        if (normalizedSearch === (search.search ?? "")) return;

        const timeout = window.setTimeout(() => {
            void navigate({
                replace: true,
                resetScroll: false,
                search: (prev) => ({ ...prev, search: normalizedSearch || undefined, page: 1 }),
            })
        }, 350);

        return () => window.clearTimeout(timeout);
    }, [navigate, search.search, searchInput]);

    const changePage = (page: number) => {
        void navigate({ search: (prev) => ({ ...prev, page }) })
    };

    const changeWatchFilter = (watch: MediaWatchFilter) => {
        storeWatchFilter(id, watch)
        void navigate({ search: (prev) => ({ ...prev, watch, page: 1 }), resetScroll: false })
    };

    const pageHref = (page: number) => {
        const query = new URLSearchParams();

        if (search.search) query.set("search", search.search);
        if (search.sort && search.sort !== "recent") query.set("sort", search.sort);
        if (search.watch && search.watch !== "all") query.set("watch", search.watch);
        if (page > 1) query.set("page", String(page));

        const queryString = query.toString();

        return `/libraries/${encodeURIComponent(id)}${queryString ? `?${queryString}` : ""}`;
    };

    return (
        <div className="min-h-svh">
            <AppHeader/>
            <main className="mx-auto flex max-w-[100rem] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
                <div>
                    <Button variant="ghost" nativeButton={false} render={<Link to="/"/>}>
                        <ArrowLeftIcon data-icon="inline-start"/>
                        My media
                    </Button>
                </div>

                {!folder &&
                    <Empty className="min-h-96 border border-border bg-card/30">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FolderSearchIcon/>
                            </EmptyMedia>
                            <EmptyTitle>Media folder not found</EmptyTitle>
                            <EmptyDescription>
                                It may have been renamed or removed in settings.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button nativeButton={false} render={<Link to="/"/>}>
                                Return to My media
                            </Button>
                        </EmptyContent>
                    </Empty>
                }

                {!!folder &&
                    <>
                        <section className="flex flex-col gap-4" aria-labelledby="folder-heading">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        <TypeIcon data-icon="inline-start"/>
                                        {folder.kind === "movies" ? "Movies" : "TV shows"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {library.stats.titles}{" "}
                                        {library.stats.titles === 1 ? "title" : "titles"}
                                    </span>
                                </div>
                                <CollectionActions
                                    folder={folder}
                                    placement="page"
                                    onDeleted={() => void navigate({ to: "/" })}
                                />
                            </div>
                            <h1 id="folder-heading" className="font-heading text-5xl leading-none font-medium tracking-tight text-balance sm:text-7xl">
                                {folder.name}
                            </h1>
                        </section>

                        <section className="flex flex-col gap-6" aria-label={`${folder.name} titles`}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <InputGroup className="w-full sm:max-w-md">
                                    <InputGroupAddon>
                                        <SearchIcon/>
                                    </InputGroupAddon>
                                    <InputGroupInput
                                        value={searchInput}
                                        aria-label={`Search ${folder.name}`}
                                        placeholder={`Search ${folder.name}…`}
                                        onChange={(event) => setSearchInput(event.target.value)}
                                    />
                                    {!!searchInput &&
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupButton
                                                size="icon-xs"
                                                aria-label="Clear search"
                                                onClick={() => setSearchInput("")}
                                            >
                                                <XIcon/>
                                            </InputGroupButton>
                                        </InputGroupAddon>
                                    }
                                </InputGroup>
                                <div className="flex w-full gap-2 sm:w-auto">
                                    <Select
                                        items={watchItems}
                                        value={search.watch ?? "all"}
                                        onValueChange={(val) => {
                                            if (val) changeWatchFilter(val)
                                        }}
                                    >
                                        <SelectTrigger className="flex-1 sm:w-36" aria-label="Filter by watch status">
                                            <SelectValue/>
                                        </SelectTrigger>
                                        <SelectContent align="end" alignItemWithTrigger={false}>
                                            <SelectGroup>
                                                {watchItems.map((item) =>
                                                    <SelectItem key={item.value} value={item.value}>
                                                        {item.label}
                                                    </SelectItem>
                                                )}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        items={sortItems}
                                        value={search.sort ?? "recent"}
                                        onValueChange={(val) => {
                                            if (val) {
                                                void navigate({
                                                    resetScroll: false,
                                                    search: (prev) => ({ ...prev, sort: val, page: 1 }),
                                                })
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="flex-1 sm:w-56" aria-label="Sort titles">
                                            <SelectValue/>
                                        </SelectTrigger>
                                        <SelectContent align="end" alignItemWithTrigger={false}>
                                            <SelectGroup>
                                                {sortItems.map((item) =>
                                                    <SelectItem key={item.value} value={item.value}>
                                                        {item.label}
                                                    </SelectItem>
                                                )}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <MediaGrid
                                items={library.items}
                                emptyTitle={search.search ? "No matching titles" : "This folder is empty"}
                                emptyDescription={
                                    search.search
                                        ? `Nothing in ${folder.name} matches “${search.search}”.`
                                        : "Use Collection actions to rescan this folder and index its media."
                                }
                            />
                            {!!library.pagination.totalItems &&
                                <MediaPagination
                                    itemLabel="titles"
                                    hrefForPage={pageHref}
                                    onPageChange={changePage}
                                    pagination={library.pagination}
                                />
                            }
                        </section>
                    </>
                }
            </main>
        </div>
    );
}

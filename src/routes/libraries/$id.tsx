import {z} from "zod";
import {api} from "@/lib/api";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {useQuery} from "@tanstack/react-query";
import {AppHeader} from "@/components/app-header";
import {MediaGrid} from "@/components/media-grid";
import {Skeleton} from "@/components/ui/skeleton";
import {Separator} from "@/components/ui/separator";
import {MouseEvent, useEffect, useState} from "react";
import {createFileRoute, Link} from "@tanstack/react-router";
import {CollectionActions} from "@/components/media-folder-card";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
import {ArrowLeftIcon, FilmIcon, FolderSearchIcon, SearchIcon, TvIcon} from "lucide-react";
import {mediaSortSchema, MediaWatchFilter, mediaWatchFilterSchema} from "@ploux/contracts";
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from "@/components/ui/empty";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious} from "@/components/ui/pagination"


const searchSchema = z.object({
    search: z.string().optional().catch(undefined),
    sort: mediaSortSchema.optional().catch("recent"),
    watch: mediaWatchFilterSchema.optional().catch("all"),
    page: z.coerce.number().int().min(1).optional().catch(1),
});


export const Route = createFileRoute("/libraries/$id")({
    validateSearch: searchSchema,
    component: MediaFolderPage,
});


const PAGE_SIZE = 28;

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
    return `ploux.media.watch-filter.${libraryId}`;
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
    const { id } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const [searchInput, setSearchInput] = useState(search.search ?? "");

    const folders = useQuery({
        queryKey: ["media-folders"],
        queryFn: api.mediaFolders,
    });

    const library = useQuery({
        queryKey: ["library", id, search],
        queryFn: () => api.library({ libraryId: id, ...search, pageSize: PAGE_SIZE }),
    });

    const folder = folders.data?.find((candidate) => candidate.id === id);
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
        const queryString = query.toString();

        if (search.search) query.set("search", search.search);
        if (search.sort && search.sort !== "recent") query.set("sort", search.sort);
        if (search.watch && search.watch !== "all") query.set("watch", search.watch);
        if (page > 1) query.set("page", String(page));

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

                {folders.isPending &&
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-5 w-28"/>
                        <Skeleton className="h-16 w-72 max-w-full"/>
                        <Skeleton className="h-5 w-44"/>
                    </div>
                }

                {(!!folders.data && !folder) &&
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

                {folders.isError &&
                    <Empty className="min-h-96 border border-border bg-card/30">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FolderSearchIcon/>
                            </EmptyMedia>
                            <EmptyTitle>Could not open this media folder</EmptyTitle>
                            <EmptyDescription>{folders.error.message}</EmptyDescription>
                        </EmptyHeader>
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
                                        {library.data?.stats.titles ?? folder.titleCount}{" "}
                                        {(library.data?.stats.titles ?? folder.titleCount) === 1 ? "title" : "titles"}
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

                            {library.isPending && <MediaGridSkeleton/>}

                            {library.isError &&
                                <Empty className="min-h-80 border border-border bg-card/30">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <FolderSearchIcon/>
                                        </EmptyMedia>
                                        <EmptyTitle>Could not open this media folder</EmptyTitle>
                                        <EmptyDescription>
                                            {library.error.message}
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            }
                            {!!library.data &&
                                <>
                                    <MediaGrid
                                        items={library.data.items}
                                        emptyTitle={search.search ? "No matching titles" : "This folder is empty"}
                                        emptyDescription={
                                            search.search
                                                ? `Nothing in ${folder.name} matches “${search.search}”.`
                                                : "Use Collection actions to rescan this folder and index its media."
                                        }
                                    />
                                    {!!library.data.pagination.totalItems &&
                                        <MediaPagination
                                            hrefForPage={pageHref}
                                            onPageChange={changePage}
                                            pagination={library.data.pagination}
                                        />
                                    }
                                </>
                            }
                        </section>
                    </>
                }
            </main>
        </div>
    );
}


interface MediaPaginationProps {
    onPageChange: (page: number) => void;
    hrefForPage: (page: number) => string;
    pagination: {
        page: number,
        pageSize: number,
        totalItems: number,
        totalPages: number,
    };
}


function MediaPagination({ pagination, hrefForPage, onPageChange }: MediaPaginationProps) {
    const { page, pageSize, totalItems, totalPages } = pagination;

    const firstItem = (page - 1) * pageSize + 1;
    const lastItem = Math.min(page * pageSize, totalItems);

    const pageNumbers = [...new Set([1, page - 1, page, page + 1, totalPages])]
        .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
        .sort((left, right) => left - right);

    const handlePageClick = (targetPage: number) => {
        return (ev: MouseEvent<HTMLAnchorElement>) => {
            if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

            ev.preventDefault();
            onPageChange(targetPage);
        };
    };

    return (
        <div className="flex flex-col gap-6">
            <Separator/>
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-xs text-muted-foreground">
                    Showing {firstItem}–{lastItem} of {totalItems} titles
                </p>
                {totalPages > 1 &&
                    <Pagination className="mx-0 w-auto">
                        <PaginationContent>
                            {page > 1 &&
                                <PaginationItem>
                                    <PaginationPrevious
                                        href={hrefForPage(page - 1)}
                                        onClick={handlePageClick(page - 1)}
                                    />
                                </PaginationItem>
                            }

                            {pageNumbers.flatMap((pageNumber, idx) => {
                                const previousPage = pageNumbers[idx - 1];
                                const hasGap = previousPage !== undefined && pageNumber - previousPage > 1;

                                return [
                                    hasGap &&
                                    <PaginationItem key={`ellipsis-${pageNumber}`}>
                                        <PaginationEllipsis/>
                                    </PaginationItem>
                                    ,
                                    <PaginationItem key={pageNumber}>
                                        <PaginationLink
                                            href={hrefForPage(pageNumber)}
                                            isActive={pageNumber === page}
                                            onClick={handlePageClick(pageNumber)}
                                        >
                                            {pageNumber}
                                        </PaginationLink>
                                    </PaginationItem>,
                                ]
                            })}

                            {page < totalPages &&
                                <PaginationItem>
                                    <PaginationNext
                                        href={hrefForPage(page + 1)}
                                        onClick={handlePageClick(page + 1)}
                                    />
                                </PaginationItem>
                            }
                        </PaginationContent>
                    </Pagination>
                }
            </div>
        </div>
    )
}


function MediaGridSkeleton() {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {Array.from({ length: 12 }, (_, idx) =>
                <div key={idx} className="flex flex-col gap-3">
                    <Skeleton className="aspect-2/3 w-full rounded-xl"/>
                    <Skeleton className="h-4 w-4/5"/>
                    <Skeleton className="h-3 w-2/5"/>
                </div>
            )}
        </div>
    );
}

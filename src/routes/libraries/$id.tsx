import {mediaSortSchema} from "@ploux/contracts"
import {useQuery} from "@tanstack/react-query"
import {createFileRoute, Link} from "@tanstack/react-router"
import {ArrowLeftIcon, FilmIcon, FolderSearchIcon, SearchIcon, TvIcon} from "lucide-react"
import {z} from "zod"
import {AppHeader} from "@/components/app-header"
import {MediaGrid} from "@/components/media-grid"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from "@/components/ui/empty"
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group"
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {api} from "@/lib/api"


const searchSchema = z.object({
    search: z.string().optional().catch(undefined),
    sort: mediaSortSchema.optional().catch("recent"),
})

const sortItems = [
    { label: "Recently added", value: "recent" },
    { label: "Title A–Z", value: "title" },
    { label: "Newest year", value: "year" },
    { label: "Unwatched first", value: "unwatched" },
] as const

export const Route = createFileRoute("/libraries/$id")({
    validateSearch: searchSchema,
    component: MediaFolderPage,
})


function MediaFolderPage() {
    const {id} = Route.useParams()
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    const folders = useQuery({
        queryKey: ["media-folders"],
        queryFn: api.mediaFolders,
    })
    const library = useQuery({
        queryKey: ["library", id, search],
        queryFn: () => api.library({libraryId: id, ...search}),
    })
    const folder = folders.data?.find((candidate) => candidate.id === id)
    const TypeIcon = folder?.kind === "series" ? TvIcon : FilmIcon

    const updateSearch = (value: string) => {
        void navigate({
            search: (previous) => ({...previous, search: value || undefined}),
            replace: true,
        })
    }

    return (
        <div className="min-h-svh">
            <AppHeader/>
            <main className="mx-auto flex max-w-[100rem] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
                <div>
                    <Button
                        variant="ghost"
                        nativeButton={false}
                        render={<Link to="/"/>}
                    >
                        <ArrowLeftIcon data-icon="inline-start"/>
                        My media
                    </Button>
                </div>

                {folders.isPending ? (
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-5 w-28"/>
                        <Skeleton className="h-16 w-72 max-w-full"/>
                        <Skeleton className="h-5 w-44"/>
                    </div>
                ) : null}

                {folders.data && !folder ? (
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
                ) : null}

                {folders.isError ? (
                    <Empty className="min-h-96 border border-border bg-card/30">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FolderSearchIcon/>
                            </EmptyMedia>
                            <EmptyTitle>Could not open this media folder</EmptyTitle>
                            <EmptyDescription>{folders.error.message}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : null}

                {folder ? (
                    <>
                        <section className="flex flex-col gap-4" aria-labelledby="folder-heading">
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
                            <h1
                                id="folder-heading"
                                className="font-heading text-5xl leading-none font-medium tracking-tight text-balance sm:text-7xl"
                            >
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
                                        aria-label={`Search ${folder.name}`}
                                        placeholder={`Search ${folder.name}…`}
                                        value={search.search ?? ""}
                                        onChange={(event) => updateSearch(event.target.value)}
                                    />
                                </InputGroup>
                                <Select
                                    items={sortItems}
                                    value={search.sort ?? "recent"}
                                    onValueChange={(value) => {
                                        if (value) {
                                            void navigate({
                                                search: (previous) => ({...previous, sort: value}),
                                            })
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-full sm:w-44" aria-label="Sort titles">
                                        <SelectValue/>
                                    </SelectTrigger>
                                    <SelectContent align="end" alignItemWithTrigger={false}>
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

                            {library.isPending ? <MediaGridSkeleton/> : null}
                            {library.isError ? (
                                <Empty className="min-h-80 border border-border bg-card/30">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <FolderSearchIcon/>
                                        </EmptyMedia>
                                        <EmptyTitle>Could not open this media folder</EmptyTitle>
                                        <EmptyDescription>{library.error.message}</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : null}
                            {library.data ? (
                                <MediaGrid
                                    items={library.data.items}
                                    emptyTitle={search.search ? "No matching titles" : "This folder is empty"}
                                    emptyDescription={
                                        search.search
                                            ? `Nothing in ${folder.name} matches “${search.search}”.`
                                            : "Scan this folder from settings to index its media."
                                    }
                                />
                            ) : null}
                        </section>
                    </>
                ) : null}
            </main>
        </div>
    )
}


function MediaGridSkeleton() {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {Array.from({length: 12}, (_, index) => (
                <div key={index} className="flex flex-col gap-3">
                    <Skeleton className="aspect-[2/3] w-full rounded-xl"/>
                    <Skeleton className="h-4 w-4/5"/>
                    <Skeleton className="h-3 w-2/5"/>
                </div>
            ))}
        </div>
    )
}

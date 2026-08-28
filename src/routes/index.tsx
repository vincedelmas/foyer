import type {MediaFolderSummary} from "@ploux/contracts"
import {tmdbImage} from "@ploux/contracts"
import {useQuery} from "@tanstack/react-query"
import {createFileRoute, Link} from "@tanstack/react-router"
import {ArrowUpRightIcon, FilmIcon, FolderPlusIcon, FoldersIcon, TvIcon} from "lucide-react"
import type React from "react"
import {AppHeader} from "@/components/app-header"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from "@/components/ui/empty"
import {Skeleton} from "@/components/ui/skeleton"
import {api} from "@/lib/api"


export const Route = createFileRoute("/")({ component: HomePage })


function HomePage() {
    const folders = useQuery({
        queryKey: ["media-folders"],
        queryFn: api.mediaFolders,
    })

    return (
        <div className="min-h-svh">
            <AppHeader/>
            <main className="mx-auto flex max-w-[100rem] flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-20">
                <section className="flex flex-col gap-8" aria-labelledby="media-folders-heading">
                    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                        <div className="max-w-2xl">
                            <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                                Your shelves
                            </p>
                            <h1
                                id="media-folders-heading"
                                className="font-heading text-5xl leading-none font-medium tracking-tight sm:text-7xl"
                            >
                                My media
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                                Every folder is its own collection, arranged exactly the way
                                you keep it on your server.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            nativeButton={false}
                            render={<Link to="/settings"/>}
                        >
                            <FolderPlusIcon data-icon="inline-start"/>
                            Add media folder
                        </Button>
                    </div>

                    {folders.isPending ? <FolderGridSkeleton/> : null}

                    {folders.isError ? (
                        <Empty className="min-h-80 border border-border bg-card/30">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <FoldersIcon/>
                                </EmptyMedia>
                                <EmptyTitle>Could not open your media folders</EmptyTitle>
                                <EmptyDescription>{folders.error.message}</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : null}

                    {folders.data?.length ? (
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {folders.data.map((folder, index) => (
                                <MediaFolderCard
                                    key={folder.id}
                                    folder={folder}
                                    index={index}
                                />
                            ))}
                        </div>
                    ) : null}

                    {folders.data && !folders.data.length ? (
                        <Empty className="min-h-96 border border-border bg-card/30">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <FolderPlusIcon/>
                                </EmptyMedia>
                                <EmptyTitle>Your shelves are ready</EmptyTitle>
                                <EmptyDescription>
                                    Add a server folder and choose whether it contains movies or
                                    TV shows, then scan it to fill the collection.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button nativeButton={false} render={<Link to="/settings"/>}>
                                    <FolderPlusIcon data-icon="inline-start"/>
                                    Add your first folder
                                </Button>
                            </EmptyContent>
                        </Empty>
                    ) : null}
                </section>
            </main>
        </div>
    )
}


function MediaFolderCard({
    folder,
    index,
}: {
    folder: MediaFolderSummary
    index: number
}) {
    const TypeIcon = folder.kind === "movies" ? FilmIcon : TvIcon
    const artwork = Array.from({ length: 5 }, (_, artworkIndex) =>
        folder.posterPaths[artworkIndex]
    )

    return (
        <Link
            to="/libraries/$id"
            params={{ id: folder.id }}
            className="group block rounded-xl outline-none"
            aria-label={`Open ${folder.name}`}
        >
            <Card
                data-archive-item
                className="relative aspect-[16/10] gap-0 py-0 transition duration-300 group-hover:-translate-y-1 group-hover:ring-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                style={{ "--archive-index": index } as React.CSSProperties}
            >
                <CardContent className="absolute inset-0 grid grid-cols-[1.35fr_1fr_1fr] grid-rows-2 gap-px bg-border px-0">
                    {artwork.map((posterPath, artworkIndex) => {
                        const poster = tmdbImage(posterPath, "w500")
                        return (
                            <div
                                key={artworkIndex}
                                className={artworkIndex === 0 ? "row-span-2 bg-muted" : "bg-muted"}
                            >
                                {poster ? (
                                    <img
                                        src={poster}
                                        alt=""
                                        loading="lazy"
                                        className="size-full object-cover transition duration-700 group-hover:scale-[1.025]"
                                    />
                                ) : (
                                    <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_top,var(--accent),var(--muted))]">
                                        <TypeIcon className="size-5 text-muted-foreground/40"/>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </CardContent>
                <div className="absolute inset-0 bg-linear-to-t from-background via-background/30 to-transparent"/>
                <CardHeader className="absolute inset-x-0 bottom-0 gap-2 p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                            <TypeIcon data-icon="inline-start"/>
                            {folder.kind === "movies" ? "Movies" : "TV shows"}
                        </Badge>
                    </div>
                    <CardTitle className="truncate text-3xl sm:text-4xl">
                        {folder.name}
                    </CardTitle>
                    <CardDescription>
                        {folder.titleCount} {folder.titleCount === 1 ? "title" : "titles"}
                    </CardDescription>
                    <CardAction className="grid size-10 place-items-center self-end rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:rotate-3 group-hover:scale-105">
                        <ArrowUpRightIcon className="size-5"/>
                    </CardAction>
                </CardHeader>
            </Card>
        </Link>
    )
}


function FolderGridSkeleton() {
    return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="aspect-[16/10] rounded-xl"/>
            ))}
        </div>
    )
}

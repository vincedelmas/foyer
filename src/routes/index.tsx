import {api} from "@/lib/api";
import {Button} from "@/components/ui/button";
import {useQuery} from "@tanstack/react-query";
import {Skeleton} from "@/components/ui/skeleton";
import {AppHeader} from "@/components/app-header";
import {FolderPlusIcon, FoldersIcon} from "lucide-react";
import {createFileRoute, Link} from "@tanstack/react-router";
import {MediaFolderCard} from "@/components/media-folder-card";
import {CurrentlyWatchingSection} from "@/components/currently-watching-section";
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from "@/components/ui/empty";


export const Route = createFileRoute("/")({
    component: HomePage,
})


function HomePage() {
    const folders = useQuery({
        queryKey: ["media-folders"],
        queryFn: api.mediaFolders,
    });

    return (
        <div className="min-h-svh">
            <AppHeader/>

            <main className="mx-auto flex max-w-[100rem] flex-col gap-16 px-4 py-10 sm:px-6 sm:py-14 lg:gap-20 lg:px-10 lg:py-20">
                <section className="flex flex-col gap-8" aria-labelledby="media-folders-heading">
                    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                        <div className="max-w-2xl">
                            <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                                Your shelves
                            </p>
                            <h1 id="media-folders-heading" className="font-heading text-5xl leading-none font-medium tracking-tight sm:text-7xl">
                                My media
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                                Every folder is its own collection, arranged exactly the way
                                you keep it on your server.
                            </p>
                        </div>
                        <Button variant="outline" nativeButton={false} render={<Link to="/settings"/>}>
                            <FolderPlusIcon data-icon="inline-start"/>
                            Create a new collection
                        </Button>
                    </div>

                    {folders.isPending && <FolderGridSkeleton/>}

                    {folders.isError &&
                        <Empty className="min-h-80 border border-border bg-card/30">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <FoldersIcon/>
                                </EmptyMedia>
                                <EmptyTitle>Could not open your media folders</EmptyTitle>
                                <EmptyDescription>
                                    {folders.error.message}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }

                    {folders.data?.length &&
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {folders.data.map((folder, idx) =>
                                <MediaFolderCard
                                    index={idx}
                                    key={folder.id}
                                    folder={folder}
                                />
                            )}
                        </div>
                    }

                    {folders.data && !folders.data.length &&
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
                                    Create your first collection
                                </Button>
                            </EmptyContent>
                        </Empty>
                    }
                </section>
                <CurrentlyWatchingSection/>
            </main>
        </div>
    );
}


function FolderGridSkeleton() {
    return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, idx) => (
                <Skeleton
                    key={idx}
                    className="aspect-16/10 rounded-xl"
                />
            ))}
        </div>
    );
}

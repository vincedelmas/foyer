import {useQuery} from "@tanstack/react-query"
import {ClapperboardIcon} from "lucide-react"
import {MediaGrid} from "@/components/media-grid"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"
import {Skeleton} from "@/components/ui/skeleton"
import {api} from "@/lib/api"


export function CurrentlyWatchingSection() {
    const watching = useQuery({
        queryKey: ["currently-watching"],
        queryFn: api.currentlyWatching,
    })

    return (
        <section className="flex flex-col gap-8" aria-labelledby="currently-watching-heading">
            <div className="max-w-2xl">
                <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                    Pick up where you left off
                </p>
                <h2
                    id="currently-watching-heading"
                    className="font-heading text-4xl leading-none font-medium tracking-tight sm:text-5xl"
                >
                    Currently watching
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Unfinished movies and shows, with your latest progress first.
                </p>
            </div>

            {watching.isPending ? <CurrentlyWatchingSkeleton/> : null}

            {watching.isError ? (
                <Empty className="min-h-64 border border-border bg-card/30">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ClapperboardIcon/>
                        </EmptyMedia>
                        <EmptyTitle>Could not load your watch progress</EmptyTitle>
                        <EmptyDescription>{watching.error.message}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : null}

            {watching.data?.length ? (
                <MediaGrid items={watching.data}/>
            ) : null}

            {watching.data && !watching.data.length ? (
                <Empty className="min-h-64 border border-dashed border-border bg-card/20">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ClapperboardIcon/>
                        </EmptyMedia>
                        <EmptyTitle>Nothing in progress</EmptyTitle>
                        <EmptyDescription>
                            Start a movie or episode and it will appear here automatically.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : null}
        </section>
    )
}


function CurrentlyWatchingSkeleton() {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {Array.from({length: 7}, (_, index) => (
                <div key={index} className="flex flex-col gap-3">
                    <Skeleton className="aspect-2/3 rounded-xl"/>
                    <Skeleton className="h-4 w-3/4"/>
                </div>
            ))}
        </div>
    )
}

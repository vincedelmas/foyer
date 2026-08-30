import {MediaSummary} from "@ploux/contracts";
import {ClapperboardIcon} from "lucide-react";
import {MediaGrid} from "@/components/media-grid";
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from "@/components/ui/empty";


export function CurrentlyWatchingSection({ items }: { items: MediaSummary[] }) {
    return (
        <section className="flex flex-col gap-8" aria-labelledby="currently-watching-heading">
            <div className="max-w-2xl">
                <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                    Pick up where you left off
                </p>
                <h2 id="currently-watching-heading" className="font-heading text-4xl leading-none font-medium tracking-tight sm:text-5xl">
                    Currently watching
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Unfinished movies and shows, with your latest progress first.
                </p>
            </div>

            {!!items.length && <MediaGrid items={items}/>}

            {!items.length &&
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
            }
        </section>
    );
}

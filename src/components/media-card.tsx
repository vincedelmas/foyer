import type {CSSProperties} from "react";
import {Link} from "@tanstack/react-router";
import {Badge} from "@/components/ui/badge";
import {FilmIcon, PlayIcon} from "lucide-react";
import {Progress} from "@/components/ui/progress";
import {MediaActionsMenu} from "@/components/media-actions-menu";
import {MediaWatchToggle} from "@/components/media-watch-toggle";
import {formatRuntime, MediaSummary, tmdbImage} from "@foyer/contracts";


interface MediaCardProps {
    index?: number;
    item: MediaSummary;
}


export function MediaCard({ item, index = 0 }: MediaCardProps) {
    const poster = tmdbImage(item.posterPath, "w500");

    const cardMetadata = [
        item.year ?? "Unknown year",
        ...(item.kind === "movie" && item.runtimeMinutes ? [formatRuntime(item.runtimeMinutes)] : []),
        item.kind === "movie" ? "Movie" : "TV show",
        ...(item.kind !== "movie" ? [`${item.partCount} ${item.partCount === 1 ? "ep." : "eps."}`] : []),
    ];

    return (
        <article data-archive-item className="group relative min-w-0" style={{ "--archive-index": index } as CSSProperties}>
            <Link
                to="/media/$id"
                params={{ id: item.id }}
                aria-label={`Open ${item.title}`}
                className="group/poster block rounded-xl outline-none"
            >
                <div
                    className="poster-shadow relative aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-border transition duration-300
                    group-hover/poster:ring-primary/60 group-focus-visible/poster:ring-2 group-focus-visible/poster:ring-ring">
                    {poster ?
                        <img
                            alt=""
                            src={poster}
                            loading="lazy"
                            className="size-full object-cover transition duration-500 group-hover/poster:scale-[1.035]"
                        />
                        :
                        <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_top,var(--accent),var(--muted))]">
                            <FilmIcon className="size-10 text-muted-foreground"/>
                        </div>
                    }

                    <div className="absolute inset-0 bg-linear-to-t from-background/90 via-transparent to-transparent opacity-0
                    transition-opacity group-hover/poster:opacity-100"/>

                    <span className="absolute right-3 bottom-5 grid size-10 translate-y-2 place-items-center rounded-full bg-primary
                    text-primary-foreground opacity-0 shadow-lg transition group-hover/poster:translate-y-0 group-hover/poster:opacity-100">
                        <PlayIcon className="size-4 fill-current"/>
                    </span>

                    <div className="absolute top-12 left-3 flex flex-col items-start gap-1.5">
                        {item.metadataStatus === "unmatched" &&
                            <Badge variant="secondary">
                                Unmatched
                            </Badge>
                        }
                    </div>

                    {item.progress && item.progress.positionSeconds > 0 && !item.progress.completed &&
                        <Progress
                            value={item.progress.percentage}
                            className="absolute right-2 bottom-2 left-2 h-1"
                        />
                    }
                </div>
            </Link>
            <div className="absolute top-2 left-2">
                <MediaWatchToggle item={item}/>
            </div>
            <div className="absolute top-2 right-2">
                <MediaActionsMenu item={item}/>
            </div>
            <div className="mt-3 min-w-0 px-0.5">
                <Link to="/media/$id" params={{ id: item.id }} className="outline-none">
                    <h3 className="truncate text-sm font-semibold tracking-tight">
                        {item.title}
                    </h3>
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    {cardMetadata.join(" · ")}
                </p>
            </div>
        </article>
    );
}

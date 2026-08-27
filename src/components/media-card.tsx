import type { MediaSummary } from "@ploux/contracts"
import { tmdbImage } from "@ploux/contracts"
import { Link } from "@tanstack/react-router"
import { FilmIcon, PlayIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export function MediaCard({
  item,
  index = 0,
}: {
  item: MediaSummary
  index?: number
}) {
  const poster = tmdbImage(item.posterPath, "w500")
  return (
    <article
      data-archive-item
      style={{ "--archive-index": index } as React.CSSProperties}
      className="group min-w-0"
    >
      <Link
        to="/media/$id"
        params={{ id: item.id }}
        className="flex flex-col gap-3 outline-none"
      >
        <div className="poster-shadow relative aspect-[2/3] overflow-hidden rounded-xl bg-muted ring-1 ring-border transition duration-300 group-hover:-translate-y-1.5 group-hover:ring-primary/60 group-focus-visible:ring-2 group-focus-visible:ring-ring">
          {poster ? (
            <img
              src={poster}
              alt=""
              loading="lazy"
              className="size-full object-cover transition duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_top,var(--accent),var(--muted))]">
              <FilmIcon className="size-10 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="absolute right-3 bottom-3 grid size-10 translate-y-2 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100">
            <PlayIcon className="size-4 fill-current" />
          </span>
          {item.metadataStatus === "unmatched" ? (
            <Badge variant="secondary" className="absolute top-3 left-3">
              Unmatched
            </Badge>
          ) : null}
          {item.progress && item.progress.positionSeconds > 0 ? (
            <Progress
              value={item.progress.percentage}
              className="absolute right-2 bottom-2 left-2 h-1"
            />
          ) : null}
        </div>
        <div className="min-w-0 px-0.5">
          <h3 className="truncate text-sm font-semibold tracking-tight">
            {item.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.year ?? "Unknown year"} ·{" "}
            {item.kind === "movie"
              ? "Movie"
              : item.kind === "anime"
                ? "Anime"
                : "Series"}
          </p>
        </div>
      </Link>
    </article>
  )
}

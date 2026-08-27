import { Link, useLocation } from "@tanstack/react-router"
import { ClapperboardIcon, SearchIcon, Settings2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
const navigation = [
  { label: "Home", kind: undefined },
  { label: "Movies", kind: "movie" as const },
  { label: "Series", kind: "series" as const },
  { label: "Anime", kind: "anime" as const },
]

export function AppHeader({
  search,
  onSearchChange,
}: {
  search?: string
  onSearchChange?: (value: string) => void
}) {
  const location = useLocation()
  const currentKind = new URLSearchParams(location.searchStr).get("kind")

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/78 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[100rem] items-center gap-5 px-4 sm:px-6 lg:px-10">
        <Link
          to="/"
          search={{ kind: undefined, search: undefined, sort: "recent" }}
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:-rotate-6">
            <ClapperboardIcon className="size-4" />
          </span>
          <span className="font-heading text-xl font-semibold tracking-tight">
            Ploux
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <Button
              key={item.label}
              variant={
                currentKind === (item.kind ?? null) && location.pathname === "/"
                  ? "secondary"
                  : "ghost"
              }
              size="sm"
              render={
                <Link
                  to="/"
                  search={{
                    kind: item.kind,
                    search: undefined,
                    sort: "recent",
                  }}
                />
              }
              nativeButton={false}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {onSearchChange ? (
            <InputGroup className="hidden w-[min(28vw,22rem)] sm:flex">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search your library"
                placeholder="Search the archive…"
                value={search ?? ""}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </InputGroup>
          ) : null}
          <Button
            variant={location.pathname === "/admin" ? "secondary" : "ghost"}
            size="icon"
            render={<Link to="/admin" />}
            nativeButton={false}
            aria-label="Open administration"
          >
            <Settings2Icon />
          </Button>
        </div>
      </div>
    </header>
  )
}

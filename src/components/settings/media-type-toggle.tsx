import type {LibraryKind} from "@ploux/contracts"
import {FilmIcon, TvIcon} from "lucide-react"
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group"


const mediaTypes = [
    {label: "Movies", value: "movies", icon: FilmIcon},
    {label: "TV shows", value: "series", icon: TvIcon},
] as const


export function MediaTypeToggle({
    value,
    onValueChange,
}: {
    value: LibraryKind
    onValueChange: (value: LibraryKind) => void
}) {
    return (
        <ToggleGroup
            variant="segmented"
            className="w-full"
            value={[value]}
            aria-label="Media type"
            onValueChange={(nextValue) => {
                if (nextValue[0]) onValueChange(nextValue[0] as LibraryKind)
            }}
        >
            {mediaTypes.map((item) => {
                const Icon = item.icon
                return (
                    <ToggleGroupItem
                        key={item.value}
                        value={item.value}
                        className="min-w-0 flex-1"
                        aria-label={item.label}
                    >
                        <Icon data-icon="inline-start"/>
                        {item.label}
                    </ToggleGroupItem>
                )
            })}
        </ToggleGroup>
    )
}

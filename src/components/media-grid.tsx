import {MediaSummary} from "@foyer/contracts";
import {FolderSearchIcon} from "lucide-react";
import {MediaCard} from "@/components/media-card";
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from "@/components/ui/empty";


const EMPTY_DESC = "Add a media folder in settings, scan it, or loosen this search.";


interface MediaGridProps {
    emptyTitle?: string;
    items: MediaSummary[];
    emptyDescription?: string;
}


export function MediaGrid({ items, emptyTitle = "No titles found", emptyDescription = EMPTY_DESC }: MediaGridProps) {
    if (!items.length) {
        return (
            <Empty className="min-h-80 border border-dashed border-border bg-card/30">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <FolderSearchIcon/>
                    </EmptyMedia>
                    <EmptyTitle>{emptyTitle}</EmptyTitle>
                    <EmptyDescription>{emptyDescription}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {items.map((item, idx) =>
                <MediaCard
                    item={item}
                    index={idx}
                    key={item.id}
                />
            )}
        </div>
    );
}

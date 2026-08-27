import {MediaSummary} from "@ploux/contracts";
import {FolderSearchIcon} from "lucide-react";
import {MediaCard} from "@/components/media-card";
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,} from "@/components/ui/empty";


export function MediaGrid({ items }: { items: MediaSummary[] }) {
    if (!items.length) {
        return (
            <Empty className="min-h-80 border border-dashed border-border bg-card/30">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <FolderSearchIcon/>
                    </EmptyMedia>
                    <EmptyTitle>No titles found</EmptyTitle>
                    <EmptyDescription>
                        Add a library in Administration, scan it, or loosen this search.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {items.map((item, index) =>
                <MediaCard
                    item={item}
                    key={item.id}
                    index={index}
                />
            )}
        </div>
    );
}

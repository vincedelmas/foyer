import {MouseEvent} from "react";
import {Separator} from "@/components/ui/separator";
import {Pagination as PaginationState} from "@foyer/contracts";
import {Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious} from "@/components/ui/pagination";


interface MediaPaginationProps {
    itemLabel: string;
    pagination: PaginationState;
    onPageChange: (page: number) => void;
    hrefForPage: (page: number) => string;
}


export function MediaPagination({ pagination, itemLabel, hrefForPage, onPageChange }: MediaPaginationProps) {
    const { page, pageSize, totalItems, totalPages } = pagination;
    const firstItem = (page - 1) * pageSize + 1;
    const lastItem = Math.min(page * pageSize, totalItems);

    const pageNumbers = [...new Set([1, page - 1, page, page + 1, totalPages])]
        .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
        .sort((left, right) => left - right);

    const handlePageClick = (targetPage: number) => {
        return (ev: MouseEvent<HTMLAnchorElement>) => {
            if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

            ev.preventDefault();
            onPageChange(targetPage);
        };
    };

    return (
        <div className="flex flex-col gap-6">
            <Separator/>
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-xs text-muted-foreground">
                    Showing {firstItem}–{lastItem} of {totalItems} {itemLabel}
                </p>
                {totalPages > 1 &&
                    <Pagination className="mx-0 w-auto">
                        <PaginationContent>
                            {page > 1 &&
                                <PaginationItem>
                                    <PaginationPrevious
                                        href={hrefForPage(page - 1)}
                                        onClick={handlePageClick(page - 1)}
                                    />
                                </PaginationItem>
                            }

                            {pageNumbers.flatMap((pageNumber, index) => {
                                const previousPage = pageNumbers[index - 1];
                                const hasGap = previousPage !== undefined && pageNumber - previousPage > 1;

                                return [
                                    hasGap &&
                                    <PaginationItem key={`ellipsis-${pageNumber}`}>
                                        <PaginationEllipsis/>
                                    </PaginationItem>,
                                    <PaginationItem key={pageNumber}>
                                        <PaginationLink
                                            href={hrefForPage(pageNumber)}
                                            isActive={pageNumber === page}
                                            onClick={handlePageClick(pageNumber)}
                                        >
                                            {pageNumber}
                                        </PaginationLink>
                                    </PaginationItem>,
                                ];
                            })}

                            {page < totalPages &&
                                <PaginationItem>
                                    <PaginationNext
                                        href={hrefForPage(page + 1)}
                                        onClick={handlePageClick(page + 1)}
                                    />
                                </PaginationItem>
                            }
                        </PaginationContent>
                    </Pagination>
                }
            </div>
        </div>
    );
}

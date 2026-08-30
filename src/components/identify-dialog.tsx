import {useState} from "react";
import {useForm} from "@tanstack/react-form";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {SearchIcon, SparklesIcon} from "lucide-react";
import {useIdentifyMediaMutation, useSearchMetadataMutation} from "@/lib/query-mutations";
import {MediaSummary, TmdbCandidate, tmdbImage} from "@ploux/contracts";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";


interface IdentifyDialogProps {
    open?: boolean;
    showTrigger?: boolean;
    onOpenChange?: (open: boolean) => void;
    media: Pick<MediaSummary, "id" | "title" | "year">;
}


export function IdentifyDialog({ media, open: controlledOpen, onOpenChange, showTrigger = true }: IdentifyDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [candidates, setCandidates] = useState<TmdbCandidate[]>([]);

    const setOpen = (nextOpen: boolean) => {
        if (controlledOpen === undefined) {
            setInternalOpen(nextOpen);
        }

        onOpenChange?.(nextOpen);

        if (!nextOpen) {
            setCandidates([]);
        }
    };

    const identify = useIdentifyMediaMutation(media.id, () => setOpen(false));
    const search = useSearchMetadataMutation();

    const form = useForm({
        defaultValues: {
            query: media.title,
            year: media.year?.toString() ?? "",
        },
        onSubmit: async ({ value }) => {
            const result = await search.mutateAsync({
                mediaId: media.id,
                query: value.query,
                year: value.year ? Number(value.year) : undefined,
            });
            setCandidates(result.candidates);
        },
    });

    const open = controlledOpen ?? internalOpen;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {showTrigger &&
                <DialogTrigger render={<Button variant="secondary"/>}>
                    <SearchIcon data-icon="inline-start"/>
                    Identify
                </DialogTrigger>
            }
            <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Identify “{media.title}”</DialogTitle>
                    <DialogDescription>
                        Search TMDB and choose the correct match. This replaces only
                        metadata, never your files.
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        void form.handleSubmit();
                    }}
                >
                    <FieldGroup className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                        <form.Field
                            name="query"
                            validators={{
                                onChange: ({ value }) => !value.trim() ? "Enter a title" : undefined,
                            }}
                        >
                            {(field) => (
                                <Field data-invalid={!field.state.meta.isValid}>
                                    <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                                    <InputGroup>
                                        <InputGroupAddon>
                                            <SearchIcon/>
                                        </InputGroupAddon>
                                        <InputGroupInput
                                            id={field.name}
                                            value={field.state.value}
                                            onBlur={field.handleBlur}
                                            aria-invalid={!field.state.meta.isValid}
                                            onChange={(ev) => field.handleChange(ev.target.value)}
                                        />
                                    </InputGroup>
                                    <FieldError
                                        errors={field.state.meta.errors.map((message) => ({ message }))}
                                    />
                                </Field>
                            )}
                        </form.Field>
                        <form.Field name="year">
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor={field.name}>Year</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput
                                            id={field.name}
                                            inputMode="numeric"
                                            placeholder="Optional"
                                            value={field.state.value}
                                            onChange={(ev) => field.handleChange(ev.target.value.replace(/\D/g, "").slice(0, 4))}
                                        />
                                    </InputGroup>
                                </Field>
                            )}
                        </form.Field>
                        <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}>
                            {({ canSubmit, isSubmitting }) => (
                                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                                    {isSubmitting
                                        ? <Spinner data-icon="inline-start"/>
                                        : <SparklesIcon data-icon="inline-start"/>
                                    }
                                    Search
                                </Button>
                            )}
                        </form.Subscribe>
                    </FieldGroup>
                </form>

                <div className="grid gap-3 sm:grid-cols-2">
                    {candidates.map((candidate) =>
                        <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            onSelect={() => identify.mutate(candidate.id)}
                            pending={identify.isPending && identify.variables === candidate.id}
                        />
                    )}
                    {!candidates.length &&
                        <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                            Search results will appear here.
                        </p>
                    }
                </div>
            </DialogContent>
        </Dialog>
    );
}


interface CandidateCardProps {
    pending: boolean;
    onSelect: () => void;
    candidate: TmdbCandidate;
}


function CandidateCard({ candidate, pending, onSelect }: CandidateCardProps) {
    const poster = tmdbImage(candidate.posterPath, "w342");

    return (
        <article className="flex gap-3 rounded-xl border bg-card p-3">
            <div className="aspect-2/3 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {!!poster &&
                    <img
                        alt=""
                        src={poster}
                        className="size-full object-cover"
                    />
                }
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                <div className="min-w-0">
                    <h3 className="truncate font-medium">
                        {candidate.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {candidate.year ?? "Year unknown"} ·{" "}
                        {candidate.kind === "movie" ? "Movie" : "TV"}
                    </p>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {candidate.overview || "No synopsis available."}
                </p>
                <Button size="sm" variant="outline" onClick={onSelect} disabled={pending} className="mt-auto">
                    {pending && <Spinner data-icon="inline-start"/>}
                    Choose match
                </Button>
            </div>
        </article>
    );
}

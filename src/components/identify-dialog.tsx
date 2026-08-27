import {api} from "@/lib/api";
import {useState} from "react";
import {toast} from "@/components/ui/toast";
import {useForm} from "@tanstack/react-form";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {SearchIcon, SparklesIcon} from "lucide-react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {MediaDetail, TmdbCandidate, tmdbImage} from "@ploux/contracts";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";


export function IdentifyDialog({ media }: { media: MediaDetail }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [candidates, setCandidates] = useState<TmdbCandidate[]>([]);

    const identify = useMutation({
        mutationFn: (tmdbId: number) => api.identify(media.id, tmdbId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["media", media.id] })
            await queryClient.invalidateQueries({ queryKey: ["library"] })
            toast.add({
                title: "Identity updated",
                description: "TMDB metadata has been replaced.",
                type: "success",
            })
            setOpen(false)
        },
        onError: (error) =>
            toast.add({
                title: "Could not identify title",
                description: error.message,
                type: "error",
            }),
    });
    const form = useForm({
        defaultValues: { query: media.title, year: media.year?.toString() ?? "" },
        onSubmit: async ({ value }) => {
            const result = await api.searchMetadata({
                mediaId: media.id,
                query: value.query,
                year: value.year ? Number(value.year) : undefined,
            })
            setCandidates(result.candidates)
        },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="secondary"/>}>
                <SearchIcon data-icon="inline-start"/>
                Identify
            </DialogTrigger>
            <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Identify “{media.title}”</DialogTitle>
                    <DialogDescription>
                        Search TMDB and choose the correct match. This replaces only
                        metadata, never your files.
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void form.handleSubmit()
                    }}
                >
                    <FieldGroup className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                        <form.Field
                            name="query"
                            validators={{
                                onChange: ({ value }) =>
                                    !value.trim() ? "Enter a title" : undefined,
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
                                            onChange={(event) =>
                                                field.handleChange(event.target.value)
                                            }
                                            aria-invalid={!field.state.meta.isValid}
                                        />
                                    </InputGroup>
                                    <FieldError
                                        errors={field.state.meta.errors.map((message) => ({
                                            message,
                                        }))}
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
                                            onChange={(event) =>
                                                field.handleChange(
                                                    event.target.value.replace(/\D/g, "").slice(0, 4)
                                                )
                                            }
                                        />
                                    </InputGroup>
                                </Field>
                            )}
                        </form.Field>
                        <form.Subscribe
                            selector={(state) => ({
                                canSubmit: state.canSubmit,
                                isSubmitting: state.isSubmitting,
                            })}
                        >
                            {({ canSubmit, isSubmitting }) => (
                                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                                    {isSubmitting ? (
                                        <Spinner data-icon="inline-start"/>
                                    ) : (
                                        <SparklesIcon data-icon="inline-start"/>
                                    )}
                                    Search
                                </Button>
                            )}
                        </form.Subscribe>
                    </FieldGroup>
                </form>

                <div className="grid gap-3 sm:grid-cols-2">
                    {candidates.map((candidate) => (
                        <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            pending={
                                identify.isPending && identify.variables === candidate.id
                            }
                            onSelect={() => identify.mutate(candidate.id)}
                        />
                    ))}
                    {!candidates.length ? (
                        <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                            Search results will appear here.
                        </p>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}


function CandidateCard({ candidate, pending, onSelect }: { candidate: TmdbCandidate, pending: boolean, onSelect: () => void }) {
    const poster = tmdbImage(candidate.posterPath, "w342");

    return (
        <article className="flex gap-3 rounded-xl border bg-card p-3">
            <div className="aspect-2/3 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {poster ?
                    <img
                        alt=""
                        src={poster}
                        className="size-full object-cover"
                    />
                    :
                    null
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
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onSelect}
                    disabled={pending}
                    className="mt-auto"
                >
                    {pending ? <Spinner data-icon="inline-start"/> : null}
                    Choose match
                </Button>
            </div>
        </article>
    )
}

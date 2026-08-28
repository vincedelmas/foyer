import {api} from "@/lib/api";
import {Input} from "@/components/ui/input";
import {toast} from "@/components/ui/toast";
import {FilmIcon, FolderPlusIcon, TvIcon} from "lucide-react";
import {useForm} from "@tanstack/react-form";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import type {LibraryKind} from "@ploux/contracts";
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group";


const kindItems = [
    { label: "Movies", value: "movies", icon: FilmIcon },
    { label: "TV shows", value: "series", icon: TvIcon },
] as const;


export function LibraryForm() {
    const queryClient = useQueryClient();

    const create = useMutation({
        mutationFn: api.createLibrary,
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["settings"] }),
                queryClient.invalidateQueries({ queryKey: ["media-folders"] }),
            ]);
            toast.add({
                type: "success",
                title: "Media folder added",
                description: "Run a scan to index its files.",
            })
        },
        onError: (error) =>
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not add media folder",
            }),
    })

    const form = useForm({
        defaultValues: {
            name: "",
            path: "",
            kind: "movies" as LibraryKind,
        },
        onSubmit: async ({ value, formApi }) => {
            await create.mutateAsync(value);
            formApi.reset();
        },
    })

    return (
        <form
            onSubmit={(ev) => {
                ev.preventDefault()
                ev.stopPropagation()
                void form.handleSubmit()
            }}
        >
            <FieldGroup className="grid gap-4 md:grid-cols-[1fr_2fr_10rem_auto] md:items-end">
                <form.Field
                    name="name"
                    validators={{
                        onChange: ({ value }) => !value.trim() ? "Name is required" : undefined,
                    }}
                >
                    {(field) => (
                        <Field data-invalid={!field.state.meta.isValid}>
                            <FieldLabel htmlFor={field.name}>
                                Name
                            </FieldLabel>
                            <Input
                                id={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                placeholder="Fun movies"
                                aria-invalid={!field.state.meta.isValid}
                                onChange={(ev) => field.handleChange(ev.target.value)}
                            />
                            <FieldError
                                errors={field.state.meta.errors.map((message) => ({ message }))}
                            />
                        </Field>
                    )}
                </form.Field>
                <form.Field
                    name="path"
                    validators={{
                        onChange: ({ value }) => !value.trim() ? "Path is required" : undefined,
                    }}
                >
                    {(field) => (
                        <Field data-invalid={!field.state.meta.isValid}>
                            <FieldLabel htmlFor={field.name}>
                                Folder on the server
                            </FieldLabel>
                            <Input
                                id={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                placeholder="/media/movies"
                                aria-invalid={!field.state.meta.isValid}
                                onChange={(ev) => field.handleChange(ev.target.value)}
                            />
                            <FieldError
                                errors={field.state.meta.errors.map((message) => ({ message }))}
                            />
                        </Field>
                    )}
                </form.Field>
                <form.Field name="kind">
                    {(field) =>
                        <Field>
                                <FieldLabel>Media type</FieldLabel>
                            <ToggleGroup
                                variant="outline"
                                className="w-full"
                                value={[field.state.value]}
                                onValueChange={(value) => {
                                    if (value[0]) field.handleChange(value[0] as LibraryKind)
                                }}
                            >
                                {kindItems.map((item) => {
                                    const Icon = item.icon
                                    return (
                                        <ToggleGroupItem
                                            key={item.value}
                                            value={item.value}
                                            className="flex-1"
                                            aria-label={item.label}
                                        >
                                            <Icon/>
                                            {item.label}
                                        </ToggleGroupItem>
                                    )
                                })}
                            </ToggleGroup>
                        </Field>
                    }
                </form.Field>
                <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}>
                    {({ canSubmit, isSubmitting }) => (
                        <Button type="submit" disabled={!canSubmit || isSubmitting}>
                            {isSubmitting
                                ? <Spinner data-icon="inline-start"/>
                                : <FolderPlusIcon data-icon="inline-start"/>
                            }
                            Add folder
                        </Button>
                    )}
                </form.Subscribe>
            </FieldGroup>
        </form>
    );
}

import {api} from "@/lib/api";
import {Input} from "@/components/ui/input";
import {toast} from "@/components/ui/toast";
import {FolderPlusIcon} from "lucide-react";
import {useForm} from "@tanstack/react-form";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import type {LibraryKind} from "@ploux/contracts";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {MediaTypeToggle} from "@/components/settings/media-type-toggle";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";


export function LibraryForm() {
    const queryClient = useQueryClient();

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
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not add media folder",
            });
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
            <FieldGroup className="grid gap-4 md:grid-cols-[1fr_2fr_14rem_auto] md:items-end">
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
                            <MediaTypeToggle
                                value={field.state.value}
                                onValueChange={field.handleChange}
                            />
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

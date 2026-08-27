import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FolderPlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"

const kindItems = [
  { label: "Movies", value: "movies" },
  { label: "Series", value: "series" },
  { label: "Anime", value: "anime" },
  { label: "Mixed", value: "mixed" },
] as const

export function LibraryForm() {
  const queryClient = useQueryClient()
  const create = useMutation({
    mutationFn: api.createLibrary,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] })
      toast.add({
        title: "Library added",
        description: "Run a scan to index its files.",
        type: "success",
      })
    },
    onError: (error) =>
      toast.add({
        title: "Could not add library",
        description: error.message,
        type: "error",
      }),
  })
  const form = useForm({
    defaultValues: { name: "", path: "", kind: "movies" },
    onSubmit: async ({ value, formApi }) => {
      await create.mutateAsync(value)
      formApi.reset()
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <FieldGroup className="grid gap-4 md:grid-cols-[1fr_2fr_10rem_auto] md:items-end">
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              !value.trim() ? "Name is required" : undefined,
          }}
        >
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                id={field.name}
                placeholder="Living room movies"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={!field.state.meta.isValid}
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
            onChange: ({ value }) =>
              !value.trim() ? "Path is required" : undefined,
          }}
        >
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <FieldLabel htmlFor={field.name}>Folder on the server</FieldLabel>
              <Input
                id={field.name}
                placeholder="/media/movies"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={!field.state.meta.isValid}
              />
              <FieldError
                errors={field.state.meta.errors.map((message) => ({ message }))}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="kind">
          {(field) => (
            <Field>
              <FieldLabel>Content type</FieldLabel>
              <Select
                items={kindItems}
                value={field.state.value}
                onValueChange={(value) => {
                  if (value) field.handleChange(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {kindItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
                <Spinner data-icon="inline-start" />
              ) : (
                <FolderPlusIcon data-icon="inline-start" />
              )}
              Add library
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}

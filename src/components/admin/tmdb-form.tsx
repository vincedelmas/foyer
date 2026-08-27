import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { KeyRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"

export function TmdbForm({
  environmentManaged,
}: {
  environmentManaged: boolean
}) {
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: api.saveTmdbToken,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] })
      toast.add({ title: "TMDB token saved", type: "success" })
    },
    onError: (error) =>
      toast.add({
        title: "Could not save token",
        description: error.message,
        type: "error",
      }),
  })
  const form = useForm({
    defaultValues: { token: "" },
    onSubmit: async ({ value, formApi }) => {
      await save.mutateAsync(value.token)
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
      <FieldGroup>
        <form.Field name="token">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                TMDB read access token
              </FieldLabel>
              <Input
                id={field.name}
                type="password"
                autoComplete="off"
                placeholder={
                  environmentManaged
                    ? "Managed by TMDB_READ_ACCESS_TOKEN"
                    : "Paste a v4 read access token"
                }
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                disabled={environmentManaged}
              />
              <FieldDescription>
                {environmentManaged
                  ? "The environment variable takes precedence. Change it on the server and restart Ploux."
                  : "Stored locally in SQLite. Leave blank and save to remove it."}
              </FieldDescription>
            </Field>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              className="self-start"
              disabled={environmentManaged || isSubmitting}
            >
              {isSubmitting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <KeyRoundIcon data-icon="inline-start" />
              )}
              Save token
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}

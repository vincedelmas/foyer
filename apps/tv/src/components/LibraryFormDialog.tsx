import type { LibraryKind, LibraryRecord } from "@ploux/contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { tvApi } from "../api"
import { colors } from "../theme"
import { FocusButton } from "./FocusButton"
import { FocusTextInput } from "./FocusTextInput"
import { TvModal } from "./TvModal"

export function LibraryFormDialog({
  server,
  visible,
  library = null,
  onClose,
}: {
  server: string
  visible: boolean
  library?: LibraryRecord | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [path, setPath] = useState("")
  const [kind, setKind] = useState<LibraryKind>("movies")

  useEffect(() => {
    if (!visible) return
    setName(library?.name ?? "")
    setPath(library?.path ?? "")
    setKind(library?.kind ?? "movies")
  }, [library, visible])

  const save = useMutation({
    mutationFn: () =>
      library
        ? tvApi.updateLibrary(server, {
            id: library.id,
            name: name.trim(),
            path: path.trim(),
            kind,
          })
        : tvApi.createLibrary(server, {
            name: name.trim(),
            path: path.trim(),
            kind,
          }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tv-settings", server] }),
        queryClient.invalidateQueries({ queryKey: ["tv-folders", server] }),
        queryClient.invalidateQueries({ queryKey: ["tv-library", server] }),
      ])
      onClose()
    },
  })

  return (
    <TvModal
      visible={visible}
      title={library ? "Edit collection" : "Create a new collection"}
      description="Choose a display name, an absolute server folder, and the media layout Ploux should expect."
      onClose={onClose}
      width={620}
    >
      <View style={styles.form}>
        <FocusTextInput
          label="Collection name"
          value={name}
          onChangeText={setName}
          maxLength={80}
          hasTVPreferredFocus
        />
        <FocusTextInput
          label="Folder on the server"
          hint="Use an absolute path on the machine running Ploux."
          value={path}
          onChangeText={setPath}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="/srv/media/movies"
        />
        <View style={styles.typeField}>
          <Text style={styles.label}>Media type</Text>
          <View style={styles.types}>
            <FocusButton
              label="Movies"
              variant={kind === "movies" ? "primary" : "secondary"}
              onPress={() => setKind("movies")}
            />
            <FocusButton
              label="TV shows with episodes"
              variant={kind === "series" ? "primary" : "secondary"}
              onPress={() => setKind("series")}
            />
          </View>
        </View>
        {save.isError ? <Text style={styles.error}>{save.error.message}</Text> : null}
        <View style={styles.actions}>
          <FocusButton
            label="Cancel"
            variant="secondary"
            onPress={onClose}
            disabled={save.isPending}
          />
          <FocusButton
            label={save.isPending ? "Saving…" : library ? "Save changes" : "Create collection"}
            onPress={() => save.mutate()}
            disabled={!name.trim() || !path.trim() || save.isPending}
          />
        </View>
      </View>
    </TvModal>
  )
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  typeField: { gap: 6 },
  label: { color: colors.text, fontSize: 11, fontWeight: "700" },
  types: { flexDirection: "row", gap: 9 },
  error: { color: colors.danger, fontSize: 11 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 9 },
})

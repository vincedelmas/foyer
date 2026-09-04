import type { LibraryKind, LibraryRecord } from "@foyer/contracts"
import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { useSaveLibraryMutation } from "../query-mutations"
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
  library?: Pick<LibraryRecord, "id" | "name" | "path" | "kind"> | null
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [path, setPath] = useState("")
  const [kind, setKind] = useState<LibraryKind>("movies")

  useEffect(() => {
    if (!visible) return
    setName(library?.name ?? "")
    setPath(library?.path ?? "")
    setKind(library?.kind ?? "movies")
  }, [library, visible])

  const save = useSaveLibraryMutation(server, onClose)

  const saveLibrary = () => {
    const input = {
      name: name.trim(),
      path: path.trim(),
      kind,
    }

    save.mutate(library ? { ...input, id: library.id } : input)
  }

  return (
    <TvModal
      visible={visible}
      title={library ? "Edit collection" : "Create a new collection"}
      description="Choose a display name, an absolute server folder, and the media layout Foyer should expect."
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
          hint="Use an absolute path on the machine running Foyer."
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
            onPress={saveLibrary}
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
  label: { color: colors.text, fontSize: 13, fontWeight: "700" },
  types: { flexDirection: "row", gap: 9 },
  error: { color: colors.danger, fontSize: 13 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 9 },
})

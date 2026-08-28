import type { MediaFolderSummary } from "@ploux/contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  FolderInputIcon,
  FolderSyncIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { tvApi } from "../api"
import { ActionMenu } from "./ActionMenu"
import { ConfirmDialog } from "./ConfirmDialog"
import { FocusButton } from "./FocusButton"
import { FocusTextInput } from "./FocusTextInput"
import { TvModal } from "./TvModal"

type Mode = "menu" | "rename" | "path" | "delete"

export function CollectionActionsDialog({
  server,
  folder,
  visible,
  onClose,
  onDeleted,
}: {
  server: string
  folder: MediaFolderSummary | null
  visible: boolean
  onClose: () => void
  onDeleted?: (folder: MediaFolderSummary) => void
}) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>("menu")
  const [value, setValue] = useState("")

  const close = () => {
    setMode("menu")
    onClose()
  }
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tv-settings", server] }),
      queryClient.invalidateQueries({ queryKey: ["tv-library", server] }),
      queryClient.invalidateQueries({ queryKey: ["tv-folders", server] }),
      queryClient.invalidateQueries({ queryKey: ["tv-watching", server] }),
      queryClient.invalidateQueries({ queryKey: ["tv-media", server] }),
    ])
  }
  const update = useMutation({
    mutationFn: (editMode: "rename" | "path") =>
      tvApi.updateLibrary(server, {
        id: folder!.id,
        name: editMode === "rename" ? value.trim() : folder!.name,
        path: editMode === "path" ? value.trim() : folder!.path,
        kind: folder!.kind,
      }),
    onSuccess: async () => {
      await invalidate()
      close()
    },
  })
  const scan = useMutation({
    mutationFn: () => tvApi.scan(server, folder!.id),
    onSuccess: async () => {
      await invalidate()
      close()
    },
  })
  const refresh = useMutation({
    mutationFn: () => tvApi.refreshLibraryMetadata(server, folder!.id),
    onSuccess: async () => {
      await invalidate()
      close()
    },
  })
  const remove = useMutation({
    mutationFn: () => tvApi.deleteLibrary(server, folder!.id),
    onSuccess: async () => {
      const removed = folder!
      await invalidate()
      close()
      onDeleted?.(removed)
    },
  })

  if (!folder) return null
  const pending =
    update.isPending || scan.isPending || refresh.isPending || remove.isPending
  const error = update.error ?? scan.error ?? refresh.error ?? remove.error
  const openEditor = (nextMode: "rename" | "path") => {
    setValue(nextMode === "rename" ? folder.name : folder.path)
    setMode(nextMode)
  }

  return (
    <>
      <ActionMenu
        visible={visible && mode === "menu"}
        title={folder.name}
        description={
          error
            ? error.message
            : `${folder.kind === "movies" ? "Movies" : "TV shows"} · ${folder.path}`
        }
        onClose={close}
        items={[
          {
            key: "rename",
            label: "Rename collection",
            icon: PencilIcon,
            disabled: pending,
            onPress: () => openEditor("rename"),
          },
          {
            key: "path",
            label: "Change server folder",
            icon: FolderInputIcon,
            disabled: pending,
            onPress: () => openEditor("path"),
          },
          {
            key: "scan",
            label: "Rescan media folder",
            description: "Find new, changed, or removed media files.",
            icon: FolderSyncIcon,
            disabled: pending,
            pending: scan.isPending,
            onPress: () => scan.mutate(),
          },
          {
            key: "refresh",
            label: "Refresh all metadata",
            description: "Fetch fresh TMDB metadata for every matched title.",
            icon: RefreshCwIcon,
            disabled: pending,
            pending: refresh.isPending,
            onPress: () => refresh.mutate(),
          },
          {
            key: "delete",
            label: "Delete collection",
            description: "Removes only the Ploux collection, never server files.",
            icon: Trash2Icon,
            danger: true,
            disabled: pending,
            onPress: () => setMode("delete"),
          },
        ]}
      />
      <TvModal
        visible={visible && (mode === "rename" || mode === "path")}
        title={mode === "rename" ? "Rename collection" : "Change server folder"}
        description={
          mode === "rename"
            ? "Choose the name shown on the Ploux home screen."
            : "Point this collection at another absolute path on the server. Files are not moved."
        }
        onClose={() => {
          if (!update.isPending) setMode("menu")
        }}
        width={580}
      >
        <FocusTextInput
          label={mode === "rename" ? "Collection name" : "Server folder"}
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          hasTVPreferredFocus
        />
        <View style={styles.actions}>
          <FocusButton
            label="Cancel"
            variant="secondary"
            onPress={() => setMode("menu")}
            disabled={update.isPending}
          />
          <FocusButton
            label={update.isPending ? "Saving…" : "Save changes"}
            onPress={() => update.mutate(mode as "rename" | "path")}
            disabled={!value.trim() || update.isPending}
          />
        </View>
      </TvModal>
      <ConfirmDialog
        visible={visible && mode === "delete"}
        title={`Delete “${folder.name}”?`}
        description="This removes the collection, its metadata, and watch progress from Ploux. The media files on the server will not be changed."
        confirmLabel="Delete collection"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => {
          if (!remove.isPending) setMode("menu")
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 9,
  },
})

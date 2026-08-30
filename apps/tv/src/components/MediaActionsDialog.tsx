import type { MediaSummary } from "@foyer/contracts"
import {
  CheckIcon,
  CircleXIcon,
  InfoIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react-native"
import { useEffect, useState } from "react"

import {
  useClearMediaProgressMutation,
  useDeleteMediaMutation,
  useRefreshMediaMetadataMutation,
  useSetMediaWatchedMutation,
} from "../query-mutations"
import { ActionMenu } from "./ActionMenu"
import { ConfirmDialog } from "./ConfirmDialog"

export function MediaActionsDialog({
  server,
  item,
  visible,
  onClose,
  onIdentify,
  onInfo,
  onDeleted,
}: {
  server: string
  item: MediaSummary | null
  visible: boolean
  onClose: () => void
  onIdentify: (item: MediaSummary) => void
  onInfo: (item: MediaSummary) => void
  onDeleted?: (item: MediaSummary) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!visible) setConfirmDelete(false)
  }, [item?.id, visible])

  const mediaId = item?.id ?? ""
  const clearProgress = useClearMediaProgressMutation(server, mediaId, onClose)
  const watchState = useSetMediaWatchedMutation(server, mediaId, onClose)
  const refresh = useRefreshMediaMetadataMutation(server, mediaId, onClose)
  const remove = useDeleteMediaMutation(server, mediaId, () => {
      const removed = item
      setConfirmDelete(false)
      onClose()
      if (removed) onDeleted?.(removed)
  })

  if (!item) return null
  const pending =
    watchState.isPending ||
    clearProgress.isPending ||
    refresh.isPending ||
    remove.isPending
  const error =
    watchState.error ?? clearProgress.error ?? refresh.error ?? remove.error

  return (
    <>
      <ActionMenu
        visible={visible && !confirmDelete}
        title={item.title}
        description={
          error
            ? error.message
            : "Manage this title. File deletion is the only destructive action."
        }
        onClose={onClose}
        items={[
          {
            key: "watched",
            label: item.watched ? "Mark as unwatched" : "Mark as watched",
            icon: CheckIcon,
            selected: item.watched,
            disabled: pending,
            pending: watchState.isPending,
            onPress: () => watchState.mutate(!item.watched),
          },
          ...(item.hasProgress
            ? [
                {
                  key: "progress",
                  label: "Remove watch progress",
                  icon: CircleXIcon,
                  disabled: pending,
                  pending: clearProgress.isPending,
                  onPress: () => clearProgress.mutate(),
                },
              ]
            : []),
          {
            key: "identify",
            label: "Identify",
            description: "Search TMDB and replace incorrect metadata.",
            icon: SearchIcon,
            disabled: pending,
            onPress: () => {
              onClose()
              onIdentify(item)
            },
          },
          {
            key: "info",
            label: "Media info",
            description: "Files, paths, containers, streams and subtitles.",
            icon: InfoIcon,
            disabled: pending,
            onPress: () => {
              onClose()
              onInfo(item)
            },
          },
          {
            key: "refresh",
            label: "Refresh metadata",
            icon: RefreshCwIcon,
            disabled: pending || item.metadataStatus === "unmatched",
            pending: refresh.isPending,
            onPress: () => refresh.mutate(),
          },
          {
            key: "delete",
            label: "Delete media from server",
            description: "Permanently deletes every indexed file for this title.",
            icon: Trash2Icon,
            danger: true,
            disabled: pending,
            onPress: () => setConfirmDelete(true),
          },
        ]}
      />
      <ConfirmDialog
        visible={visible && confirmDelete}
        title={`Delete “${item.title}” permanently?`}
        description={`This permanently deletes ${item.partCount} ${
          item.partCount === 1 ? "media file" : "media files"
        } and indexed external subtitles from the server. This cannot be undone.`}
        confirmLabel="Delete files permanently"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => {
          if (!remove.isPending) setConfirmDelete(false)
        }}
      />
    </>
  )
}

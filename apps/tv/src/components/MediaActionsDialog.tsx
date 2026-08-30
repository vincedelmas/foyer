import type { MediaSummary } from "@ploux/contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckIcon,
  CircleXIcon,
  InfoIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react-native"
import { useEffect, useState } from "react"

import { tvApi } from "../api"
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
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!visible) setConfirmDelete(false)
  }, [item?.id, visible])

  const invalidate = async (mediaId: string, includeFolders = false) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tv-library", server] }),
      queryClient.invalidateQueries({ queryKey: ["tv-watching", server] }),
      queryClient.invalidateQueries({
        queryKey: ["tv-media", server, mediaId],
      }),
      ...(includeFolders
        ? [
            queryClient.invalidateQueries({
              queryKey: ["tv-folders", server],
            }),
          ]
        : []),
    ])
  }

  const clearProgress = useMutation({
    mutationFn: () => tvApi(server).deleteProgress(item!.id),
    onSuccess: async () => {
      await invalidate(item!.id)
      onClose()
    },
  })
  const watchState = useMutation({
    mutationFn: () => tvApi(server).setMediaWatched(item!.id, !item!.watched),
    onSuccess: async () => {
      await invalidate(item!.id)
      onClose()
    },
  })
  const refresh = useMutation({
    mutationFn: () => tvApi(server).refreshMetadata(item!.id),
    onSuccess: async () => {
      await invalidate(item!.id, true)
      onClose()
    },
  })
  const remove = useMutation({
    mutationFn: () => tvApi(server).deleteMedia(item!.id),
    onSuccess: async () => {
      const removed = item!
      await Promise.all([
        invalidate(removed.id, true),
        queryClient.invalidateQueries({ queryKey: ["tv-settings", server] }),
      ])
      queryClient.removeQueries({ queryKey: ["tv-media", server, removed.id] })
      queryClient.removeQueries({
        queryKey: ["tv-media-info", server, removed.id],
      })
      setConfirmDelete(false)
      onClose()
      onDeleted?.(removed)
    },
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
            onPress: () => watchState.mutate(),
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

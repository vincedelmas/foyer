import type { MediaFolderSummary, MediaSummary } from "@ploux/contracts"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FolderPlusIcon, FoldersIcon, PlayIcon } from "lucide-react-native"
import { useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native"

import { tvApi } from "../api"
import { AppHeader } from "../components/AppHeader"
import { CollectionActionsDialog } from "../components/CollectionActionsDialog"
import { CollectionTile } from "../components/CollectionTile"
import { FocusButton } from "../components/FocusButton"
import { IdentifyDialog } from "../components/IdentifyDialog"
import { LibraryFormDialog } from "../components/LibraryFormDialog"
import { MediaActionsDialog } from "../components/MediaActionsDialog"
import { MediaInfoDialog } from "../components/MediaInfoDialog"
import { MediaTile } from "../components/MediaTile"
import { colors, spacing } from "../theme"

export function HomeScreen({
  server,
  onOpenCollection,
  onOpenMedia,
  onOpenSettings,
}: {
  server: string
  onOpenCollection: (folder: MediaFolderSummary) => void
  onOpenMedia: (item: MediaSummary) => void
  onOpenSettings: () => void
}) {
  const queryClient = useQueryClient()
  const [collectionActions, setCollectionActions] =
    useState<MediaFolderSummary | null>(null)
  const [mediaActions, setMediaActions] = useState<MediaSummary | null>(null)
  const [identify, setIdentify] = useState<MediaSummary | null>(null)
  const [info, setInfo] = useState<MediaSummary | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const folders = useQuery({
    queryKey: ["tv-folders", server],
    queryFn: () => tvApi.mediaFolders(server),
  })
  const watching = useQuery({
    queryKey: ["tv-watching", server],
    queryFn: () => tvApi.currentlyWatching(server),
  })
  const watchState = useMutation({
    mutationFn: (input: { id: string; watched: boolean }) =>
      tvApi.setMediaWatched(server, input.id, input.watched),
    onSuccess: async (_, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tv-library", server] }),
        queryClient.invalidateQueries({ queryKey: ["tv-watching", server] }),
        queryClient.invalidateQueries({
          queryKey: ["tv-media", server, input.id],
        }),
      ])
    },
  })

  return (
    <View style={styles.screen}>
      <AppHeader
        active="home"
        onHome={() => undefined}
        onSettings={onOpenSettings}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>YOUR SHELVES</Text>
              <Text style={styles.heading}>My media</Text>
              <Text style={styles.description}>
                Every server folder is its own collection, arranged the way you keep it.
              </Text>
            </View>
            <FocusButton
              label="Create a new collection"
              icon={FolderPlusIcon}
              variant="secondary"
              onPress={() => setCreateOpen(true)}
            />
          </View>

          {folders.isPending ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : null}
          {folders.isError ? (
            <EmptyState
              icon={FoldersIcon}
              title="Could not open your collections"
              description={folders.error.message}
            />
          ) : null}
          {folders.data?.length ? (
            <View style={styles.collections}>
              {folders.data.map((folder) => (
                <CollectionTile
                  key={folder.id}
                  folder={folder}
                  onOpen={() => onOpenCollection(folder)}
                  onOpenActions={() => setCollectionActions(folder)}
                />
              ))}
            </View>
          ) : null}
          {folders.data && !folders.data.length ? (
            <EmptyState
              icon={FolderPlusIcon}
              title="Your shelves are ready"
              description="Create a collection, choose a movie or TV folder, and scan it to begin."
              action={
                <FocusButton
                  label="Create your first collection"
                  icon={FolderPlusIcon}
                  onPress={() => setCreateOpen(true)}
                />
              }
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>PICK UP WHERE YOU LEFT OFF</Text>
            <Text style={styles.subheading}>Currently watching</Text>
            <Text style={styles.description}>
              Unfinished movies and shows, with the latest progress first.
            </Text>
          </View>
          {watching.isPending ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : null}
          {watching.isError ? (
            <EmptyState
              icon={PlayIcon}
              title="Could not load watch progress"
              description={watching.error.message}
            />
          ) : null}
          {watchState.isError ? (
            <Text style={styles.error}>{watchState.error.message}</Text>
          ) : null}
          {watching.data?.length ? (
            <View style={styles.mediaGrid}>
              {watching.data.map((item) => (
                <MediaTile
                  key={item.id}
                  item={item}
                  onOpen={() => onOpenMedia(item)}
                  onToggleWatched={() =>
                    watchState.mutate({ id: item.id, watched: !item.watched })
                  }
                  onOpenActions={() => setMediaActions(item)}
                  busy={watchState.isPending && watchState.variables?.id === item.id}
                />
              ))}
            </View>
          ) : null}
          {watching.data && !watching.data.length ? (
            <EmptyState
              icon={PlayIcon}
              title="Nothing in progress"
              description="Start a title and it will appear here automatically."
            />
          ) : null}
        </View>
      </ScrollView>

      <LibraryFormDialog
        server={server}
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <CollectionActionsDialog
        server={server}
        folder={collectionActions}
        visible={collectionActions !== null}
        onClose={() => setCollectionActions(null)}
      />
      <MediaActionsDialog
        server={server}
        item={mediaActions}
        visible={mediaActions !== null}
        onClose={() => setMediaActions(null)}
        onIdentify={setIdentify}
        onInfo={setInfo}
      />
      <IdentifyDialog
        server={server}
        media={identify}
        visible={identify !== null}
        onClose={() => setIdentify(null)}
      />
      <MediaInfoDialog
        server={server}
        mediaId={info?.id ?? null}
        title={info?.title ?? ""}
        visible={info !== null}
        onClose={() => setInfo(null)}
      />
    </View>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof FoldersIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <View style={styles.empty}>
      <Icon color={colors.muted} size={42} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.page, paddingBottom: 90, gap: 76 },
  section: { gap: 28 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 30,
  },
  headingCopy: { gap: 8, maxWidth: 800 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 2.1 },
  heading: { color: colors.text, fontSize: 58, lineHeight: 62, fontWeight: "800", letterSpacing: -1.5 },
  subheading: { color: colors.text, fontSize: 44, lineHeight: 49, fontWeight: "800", letterSpacing: -1 },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  collections: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap" },
  empty: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  emptyDescription: { color: colors.muted, fontSize: 14, textAlign: "center", marginBottom: 8 },
  error: { color: colors.danger, fontSize: 13 },
})

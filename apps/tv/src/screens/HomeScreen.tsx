import type { MediaFolderSummary, MediaSummary } from "@foyer/contracts"
import { useQuery } from "@tanstack/react-query"
import { FoldersIcon, PlayIcon } from "lucide-react-native"
import { useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native"

import { currentlyWatchingOptions, mediaFoldersOptions } from "../query-options"
import { AppHeader } from "../components/AppHeader"
import { CollectionActionsDialog } from "../components/CollectionActionsDialog"
import { CollectionTile } from "../components/CollectionTile"
import { MediaDialogs, useMediaDialogs } from "../components/MediaDialogs"
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
  const [collectionActions, setCollectionActions] =
    useState<MediaFolderSummary | null>(null)
  const mediaDialogs = useMediaDialogs()

  const folders = useQuery(mediaFoldersOptions(server))
  const watching = useQuery(currentlyWatchingOptions(server))
  return (
    <View style={styles.screen}>
      <AppHeader
        active="home"
        onHome={() => undefined}
        onSettings={onOpenSettings}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>YOUR SHELVES</Text>
            <Text style={styles.heading}>My media</Text>
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
              {folders.data.map((folder, index) => (
                <CollectionTile
                  key={folder.id}
                  folder={folder}
                  hasTVPreferredFocus={index === 0}
                  onOpen={() => onOpenCollection(folder)}
                  onOpenActions={() => setCollectionActions(folder)}
                />
              ))}
            </View>
          ) : null}
          {folders.data && !folders.data.length ? (
            <EmptyState
              icon={FoldersIcon}
              title="No collections yet"
              description="Create and scan your first collection from the Foyer web app."
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
          {watching.data?.length ? (
            <View style={styles.mediaGrid}>
              {watching.data.map((item, index) => (
                <MediaTile
                  key={item.id}
                  item={item}
                  hasTVPreferredFocus={!folders.data?.length && index === 0}
                  onOpen={() => onOpenMedia(item)}
                  onOpenActions={() => mediaDialogs.openActions(item)}
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

      <CollectionActionsDialog
        server={server}
        folder={collectionActions}
        visible={collectionActions !== null}
        onClose={() => setCollectionActions(null)}
      />
      <MediaDialogs server={server} controller={mediaDialogs} />
    </View>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FoldersIcon
  title: string
  description: string
}) {
  return (
    <View style={styles.empty}>
      <Icon color={colors.muted} size={42} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.page, paddingBottom: 56, gap: 46 },
  section: { gap: 18 },
  headingCopy: { gap: 4, maxWidth: 760 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.7 },
  heading: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8 },
  subheading: { color: colors.text, fontSize: 28, lineHeight: 32, fontWeight: "800", letterSpacing: -0.5 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  collections: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap" },
  empty: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  emptyDescription: { color: colors.muted, fontSize: 12, textAlign: "center" },
})

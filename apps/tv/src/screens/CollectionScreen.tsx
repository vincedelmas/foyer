import {
  type MediaFolderSummary,
  type MediaSort,
  type MediaSummary,
  type MediaWatchFilter,
} from "@ploux/contracts"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  ArrowUpDownIcon,
  CheckIcon,
  FilmIcon,
  FilterIcon,
  SearchIcon,
  TvIcon,
} from "lucide-react-native"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { tvApi } from "../api"
import { ActionMenu } from "../components/ActionMenu"
import { AppHeader } from "../components/AppHeader"
import { CollectionActionsDialog } from "../components/CollectionActionsDialog"
import { FocusButton } from "../components/FocusButton"
import { FocusTextInput } from "../components/FocusTextInput"
import { IdentifyDialog } from "../components/IdentifyDialog"
import { MediaActionsDialog } from "../components/MediaActionsDialog"
import { MediaInfoDialog } from "../components/MediaInfoDialog"
import { MediaTile } from "../components/MediaTile"
import { colors, spacing } from "../theme"

const PAGE_SIZE = 24
const watchStorageKey = (libraryId: string) =>
  `ploux.tv.watch-filter.${libraryId}`

const watchOptions: Array<{ label: string; value: MediaWatchFilter }> = [
  { label: "All titles", value: "all" },
  { label: "Watched", value: "watched" },
  { label: "Unwatched", value: "unwatched" },
]

const sortOptions: Array<{ label: string; value: MediaSort }> = [
  { label: "Recently added", value: "recent" },
  { label: "Title A–Z", value: "title" },
  { label: "Release date · newest", value: "release-desc" },
  { label: "Release date · oldest", value: "release-asc" },
  { label: "Length · longest", value: "runtime-desc" },
  { label: "Length · shortest", value: "runtime-asc" },
  { label: "TMDB score · highest", value: "rating-desc" },
  { label: "TMDB score · lowest", value: "rating-asc" },
]

export function CollectionScreen({
  server,
  initialFolder,
  onHome,
  onOpenMedia,
  onOpenSettings,
}: {
  server: string
  initialFolder: MediaFolderSummary
  onHome: () => void
  onOpenMedia: (item: MediaSummary) => void
  onOpenSettings: () => void
}) {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [watch, setWatch] = useState<MediaWatchFilter>("all")
  const [sort, setSort] = useState<MediaSort>("recent")
  const [page, setPage] = useState(1)
  const [picker, setPicker] = useState<"watch" | "sort" | null>(null)
  const [collectionActions, setCollectionActions] =
    useState<MediaFolderSummary | null>(null)
  const [mediaActions, setMediaActions] = useState<MediaSummary | null>(null)
  const [identify, setIdentify] = useState<MediaSummary | null>(null)
  const [info, setInfo] = useState<MediaSummary | null>(null)

  const folders = useQuery({
    queryKey: ["tv-folders", server],
    queryFn: () => tvApi.mediaFolders(server),
  })
  const folder =
    folders.data?.find((candidate) => candidate.id === initialFolder.id) ??
    initialFolder

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onHome()
        return true
      }
    )
    return () => subscription.remove()
  }, [onHome])

  useEffect(() => {
    void AsyncStorage.getItem(watchStorageKey(initialFolder.id)).then((value) => {
      if (value === "watched" || value === "unwatched" || value === "all")
        setWatch(value)
    })
  }, [initialFolder.id])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const library = useQuery({
    queryKey: [
      "tv-library",
      server,
      folder.id,
      search,
      watch,
      sort,
      page,
    ],
    queryFn: () =>
      tvApi.library(server, {
        libraryId: folder.id,
        search: search || undefined,
        watch,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
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

  const changeWatch = (value: MediaWatchFilter) => {
    setWatch(value)
    setPage(1)
    setPicker(null)
    void AsyncStorage.setItem(watchStorageKey(folder.id), value)
  }
  const changeSort = (value: MediaSort) => {
    setSort(value)
    setPage(1)
    setPicker(null)
  }
  const TypeIcon = folder.kind === "movies" ? FilmIcon : TvIcon
  const watchLabel = watchOptions.find((option) => option.value === watch)!.label
  const sortLabel = sortOptions.find((option) => option.value === sort)!.label

  return (
    <View style={styles.screen}>
      <AppHeader active="other" onHome={onHome} onSettings={onOpenSettings} />
      <ScrollView contentContainerStyle={styles.content}>
        <FocusButton
          label="My media"
          icon={ArrowLeftIcon}
          variant="ghost"
          size="small"
          onPress={onHome}
          style={styles.back}
        />
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <View style={styles.badge}>
              <TypeIcon color={colors.text} size={16} />
              <Text style={styles.badgeText}>
                {folder.kind === "movies" ? "Movies" : "TV shows"}
              </Text>
            </View>
            <Text style={styles.heading}>{folder.name}</Text>
            <Text style={styles.description}>
              {library.data?.pagination.totalItems ?? folder.titleCount} titles
            </Text>
          </View>
          <FocusButton
            label="Collection options"
            variant="secondary"
            onPress={() => setCollectionActions(folder)}
          />
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchField}>
            <SearchIcon color={colors.muted} size={20} style={styles.searchIcon} />
            <FocusTextInput
              label="Search this collection"
              placeholder={`Search ${folder.name}…`}
              value={searchInput}
              onChangeText={setSearchInput}
              style={styles.searchInput}
            />
          </View>
          <FocusButton
            label={watchLabel}
            icon={FilterIcon}
            variant="secondary"
            onPress={() => setPicker("watch")}
          />
          <FocusButton
            label={sortLabel}
            icon={ArrowUpDownIcon}
            variant="secondary"
            onPress={() => setPicker("sort")}
          />
        </View>

        {library.isFetching ? (
          <Text style={styles.refreshing}>Refreshing…</Text>
        ) : null}
        {watchState.isError ? (
          <Text style={styles.error}>{watchState.error.message}</Text>
        ) : null}
        {library.isPending ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : null}
        {library.isError ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Could not open this collection</Text>
            <Text style={styles.emptyDescription}>{library.error.message}</Text>
          </View>
        ) : null}
        {library.data?.items.length ? (
          <View style={styles.grid}>
            {library.data.items.map((item) => (
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
        {library.data && !library.data.items.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matching titles</Text>
            <Text style={styles.emptyDescription}>
              Try another search or watch-status filter.
            </Text>
          </View>
        ) : null}

        {library.data && library.data.pagination.totalPages > 1 ? (
          <View style={styles.pagination}>
            <FocusButton
              label="Previous"
              variant="secondary"
              disabled={page <= 1}
              onPress={() => setPage((current) => Math.max(1, current - 1))}
            />
            <Text style={styles.pageLabel}>
              Page {library.data.pagination.page} of {library.data.pagination.totalPages}
            </Text>
            <FocusButton
              label="Next"
              variant="secondary"
              disabled={page >= library.data.pagination.totalPages}
              onPress={() =>
                setPage((current) =>
                  Math.min(library.data.pagination.totalPages, current + 1)
                )
              }
            />
          </View>
        ) : null}
      </ScrollView>

      <ActionMenu
        visible={picker === "watch"}
        title="Watch status"
        description="This choice is remembered separately for this collection."
        onClose={() => setPicker(null)}
        items={watchOptions.map((option) => ({
          key: option.value,
          label: option.label,
          icon: CheckIcon,
          selected: option.value === watch,
          onPress: () => changeWatch(option.value),
        }))}
      />
      <ActionMenu
        visible={picker === "sort"}
        title="Sort titles"
        onClose={() => setPicker(null)}
        items={sortOptions.map((option) => ({
          key: option.value,
          label: option.label,
          icon: ArrowUpDownIcon,
          selected: option.value === sort,
          onPress: () => changeSort(option.value),
        }))}
      />
      <CollectionActionsDialog
        server={server}
        folder={collectionActions}
        visible={collectionActions !== null}
        onClose={() => setCollectionActions(null)}
        onDeleted={onHome}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.page, paddingBottom: 80 },
  back: { alignSelf: "flex-start", marginTop: 10 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 30, marginTop: 22 },
  titleCopy: { gap: 9 },
  badge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, height: 32, borderRadius: 16, backgroundColor: colors.surfaceRaised },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  heading: { color: colors.text, fontSize: 58, lineHeight: 62, fontWeight: "800", letterSpacing: -1.5 },
  description: { color: colors.muted, fontSize: 14 },
  toolbar: { marginTop: 35, marginBottom: 30, flexDirection: "row", alignItems: "flex-end", gap: 12 },
  searchField: { flex: 1, maxWidth: 650, position: "relative" },
  searchIcon: { position: "absolute", left: 17, bottom: 18, zIndex: 2 },
  searchInput: { paddingLeft: 48 },
  refreshing: { color: colors.muted, alignSelf: "flex-end", marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  empty: { minHeight: 300, alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 25, fontWeight: "800" },
  emptyDescription: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13, marginBottom: 10 },
  pagination: { marginTop: 24, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 20 },
  pageLabel: { color: colors.text, minWidth: 150, textAlign: "center", fontSize: 15, fontWeight: "700" },
})

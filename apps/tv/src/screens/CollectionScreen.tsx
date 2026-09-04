import {libraryOptions, mediaFoldersOptions} from "../query-options";
import {colors, spacing} from "../theme";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Image as ExpoImage} from "expo-image";
import {MEDIA_TILE_ROW_HEIGHT, MEDIA_TILE_WIDTH, MediaTile} from "../components/MediaTile";
import {AppHeader} from "../components/AppHeader";
import {ActionMenu} from "../components/ActionMenu";
import {FocusButton} from "../components/FocusButton";
import {FocusIconButton} from "../components/FocusIconButton";
import {FocusTextInput} from "../components/FocusTextInput";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {MediaDialogs, useMediaDialogs} from "../components/MediaDialogs";
import {ActivityIndicator, BackHandler, FlatList, StyleSheet, Text, useWindowDimensions, View} from "react-native";
import {ArrowUpDownIcon, CheckIcon, FilmIcon, FilterIcon, SearchIcon, TvIcon, XIcon} from "lucide-react-native";
import {
    type LibraryResponse,
    type MediaFolderSummary,
    type MediaSort,
    type MediaSummary,
    type MediaWatchFilter,
    tmdbImage,
} from "@foyer/contracts";


const PAGE_SIZE = 50;
const GRID_GAP = 16;

const watchStorageKey = (libraryId: string) => {
    return `foyer.tv.watch-filter.${libraryId}`;
}

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


export interface CollectionBrowseState {
    page: number
    searchInput: string
    sort: MediaSort
    watch: MediaWatchFilter
    scrollOffset: number
    focusedMediaId: string | null
}


interface CollectionScreenProps {
    server: string;
    onHome: () => void;
    initialBrowseState?: CollectionBrowseState;
    onOpenSettings: (state: CollectionBrowseState) => void;
    initialFolder: MediaFolderSummary;
    onOpenMedia: (item: MediaSummary, state: CollectionBrowseState) => void;
}


export function CollectionScreen({
    server,
    initialFolder,
    initialBrowseState,
    onHome,
    onOpenMedia,
    onOpenSettings,
}: CollectionScreenProps) {
    const mediaDialogs = useMediaDialogs();
    const queryClient = useQueryClient();
    const {width} = useWindowDimensions();
    const columns = Math.max(4, Math.floor((width - spacing.page * 2 + GRID_GAP) / (MEDIA_TILE_WIDTH + GRID_GAP)));
    const listRef = useRef<FlatList<MediaSummary>>(null);
    const restoredScroll = useRef(false);
    const searchReady = useRef(false);
    const scrollOffset = useRef(initialBrowseState?.scrollOffset ?? 0);
    const focusedMediaId = useRef(initialBrowseState?.focusedMediaId ?? null);
    const [page, setPage] = useState(initialBrowseState?.page ?? 1);
    const [searchInput, setSearchInput] = useState(initialBrowseState?.searchInput ?? "");
    const [search, setSearch] = useState(initialBrowseState?.searchInput.trim() ?? "");
    const [searchOpen, setSearchOpen] = useState(false);
    const [sort, setSort] = useState<MediaSort>(initialBrowseState?.sort ?? "recent");
    const [watch, setWatch] = useState<MediaWatchFilter>(initialBrowseState?.watch ?? "all");
    const [picker, setPicker] = useState<"watch" | "sort" | null>(null);
    const browseState = useRef<CollectionBrowseState>({
        page,
        searchInput,
        sort,
        watch,
        scrollOffset: scrollOffset.current,
        focusedMediaId: focusedMediaId.current,
    });
    browseState.current = {
        page,
        searchInput,
        sort,
        watch,
        scrollOffset: scrollOffset.current,
        focusedMediaId: focusedMediaId.current,
    };

    const folders = useQuery(mediaFoldersOptions(server));

    const folder = folders.data?.find((candidate) => candidate.id === initialFolder.id) ?? initialFolder;

    useEffect(() => {
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            if (searchOpen) {
                setSearchInput("");
                setSearchOpen(false);
                return true;
            }

            onHome();
            return true;
        })

        return () => subscription.remove();
    }, [onHome, searchOpen]);

    useEffect(() => {
        if (initialBrowseState) return;
        void AsyncStorage.getItem(watchStorageKey(initialFolder.id)).then((value) => {
            if (value === "watched" || value === "unwatched" || value === "all") {
                setWatch(value);
            }
        });
    }, [initialBrowseState, initialFolder.id]);

    useEffect(() => {
        if (!searchReady.current) {
            searchReady.current = true;
            return;
        }
        const timeout = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
            scrollOffset.current = 0;
            focusedMediaId.current = null;
        }, 350);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    const libraryInput = useMemo(() => ({
        page,
        sort,
        watch,
        pageSize: PAGE_SIZE,
        libraryId: folder.id,
        search: search || undefined,
    }), [folder.id, page, search, sort, watch]);
    const library = useQuery(libraryOptions(server, libraryInput));

    useEffect(() => {
        if (!library.data || page >= library.data.pagination.totalPages) return;
        const nextOptions = libraryOptions(server, {...libraryInput, page: page + 1});
        void queryClient.prefetchQuery(nextOptions).then(() => {
            const nextPage = queryClient.getQueryData<LibraryResponse>(nextOptions.queryKey);
            const posters = nextPage?.items
                .map((item) => tmdbImage(item.posterPath, "w342"))
                .filter((uri): uri is string => Boolean(uri)) ?? [];
            if (posters.length) void ExpoImage.prefetch(posters, "disk");
        });
    }, [library.data, libraryInput, page, queryClient, server]);

    useEffect(() => {
        if (restoredScroll.current || !library.data?.items.length) return;
        restoredScroll.current = true;
        if (scrollOffset.current > 0) {
            requestAnimationFrame(() => {
                listRef.current?.scrollToOffset({offset: scrollOffset.current, animated: false});
            });
        }
    }, [library.data?.items.length]);

    const focusMedia = useCallback((item: MediaSummary) => {
        focusedMediaId.current = item.id;
        browseState.current.focusedMediaId = item.id;
    }, []);

    const openMedia = useCallback((item: MediaSummary) => {
        onOpenMedia(item, {...browseState.current, focusedMediaId: item.id});
    }, [onOpenMedia]);

    const openSettings = useCallback(() => {
        onOpenSettings({...browseState.current});
    }, [onOpenSettings]);

    const changeWatch = (value: MediaWatchFilter) => {
        setWatch(value);
        setPage(1);
        scrollOffset.current = 0;
        focusedMediaId.current = null;
        setPicker(null);
        void AsyncStorage.setItem(watchStorageKey(folder.id), value);
    };

    const changeSort = (value: MediaSort) => {
        setSort(value);
        setPage(1);
        scrollOffset.current = 0;
        focusedMediaId.current = null;
        setPicker(null);
    };

    const TypeIcon = folder.kind === "movies" ? FilmIcon : TvIcon;
    const sortLabel = sortOptions.find((option) => option.value === sort)!.label;
    const watchLabel = watchOptions.find((option) => option.value === watch)!.label;
    const restoredFocusId = initialBrowseState?.focusedMediaId;
    const preferredMediaId = library.data?.items.some((item) => item.id === restoredFocusId)
        ? restoredFocusId
        : library.data?.items[0]?.id;

    return (
        <View style={styles.screen}>
            <AppHeader active="other" onHome={onHome} onSettings={openSettings}/>
            <FlatList
                ref={listRef}
                key={`collection-${columns}`}
                data={library.data?.items ?? []}
                numColumns={columns}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                columnWrapperStyle={styles.gridRow}
                initialNumToRender={columns * 2}
                maxToRenderPerBatch={columns}
                updateCellsBatchingPeriod={40}
                windowSize={5}
                removeClippedSubviews
                scrollEventThrottle={100}
                onScroll={(event) => {
                    scrollOffset.current = event.nativeEvent.contentOffset.y;
                    browseState.current.scrollOffset = scrollOffset.current;
                }}
                getItemLayout={(_, index) => ({
                    length: MEDIA_TILE_ROW_HEIGHT + GRID_GAP,
                    offset: Math.floor(index / columns) * (MEDIA_TILE_ROW_HEIGHT + GRID_GAP),
                    index,
                })}
                ListHeaderComponent={
                    <View style={styles.listHeader}>
                        <View style={styles.titleRow}>
                            <View style={styles.titleCopy}>
                                <View style={styles.badge}>
                                    <TypeIcon color={colors.text} size={17}/>
                                    <Text style={styles.badgeText}>
                                        {folder.kind === "movies" ? "Movies" : "TV shows"}
                                    </Text>
                                </View>
                                <Text style={styles.heading}>{folder.name}</Text>
                                <Text style={styles.description}>
                                    {library.data?.pagination.totalItems ?? folder.titleCount} titles · Hold Select for options
                                </Text>
                            </View>
                            <View style={styles.toolbar}>
                                {searchOpen ?
                                    <View style={styles.searchField}>
                                        <SearchIcon color={colors.muted} size={20} style={styles.searchIcon}/>
                                        <FocusTextInput
                                            autoFocus
                                            value={searchInput}
                                            style={styles.searchInput}
                                            onChangeText={setSearchInput}
                                            accessibilityLabel="Search this collection"
                                            placeholder={`Search ${folder.name}…`}
                                        />
                                        <View style={styles.searchClear}>
                                            <FocusIconButton
                                                icon={XIcon}
                                                label="Close search"
                                                onPress={() => {
                                                    setSearchInput("");
                                                    setSearchOpen(false);
                                                }}
                                            />
                                        </View>
                                    </View>
                                    :
                                    <FocusIconButton
                                        icon={SearchIcon}
                                        label="Search this collection"
                                        onPress={() => setSearchOpen(true)}
                                    />
                                }
                                <FocusButton
                                    icon={FilterIcon}
                                    label={watchLabel}
                                    variant="secondary"
                                    onPress={() => setPicker("watch")}
                                />
                                <FocusButton
                                    label={sortLabel}
                                    variant="secondary"
                                    icon={ArrowUpDownIcon}
                                    onPress={() => setPicker("sort")}
                                />
                            </View>
                        </View>
                        {library.isFetching ? <Text style={styles.refreshing}>Refreshing…</Text> : null}
                    </View>
                }
                ListEmptyComponent={
                    library.isPending ? (
                        <View style={styles.loading}>
                            <ActivityIndicator size="large" color={colors.primary}/>
                        </View>
                    ) : library.isError ? (
                        <View style={styles.empty}>
                            <Text style={styles.emptyTitle}>Could not open this collection</Text>
                            <Text style={styles.emptyDescription}>{library.error.message}</Text>
                        </View>
                    ) : (
                        <View style={styles.empty}>
                            <Text style={styles.emptyTitle}>No matching titles</Text>
                            <Text style={styles.emptyDescription}>Try another search or watch-status filter.</Text>
                        </View>
                    )
                }
                ListFooterComponent={
                    library.data && library.data.pagination.totalPages > 1 ? (
                        <View style={styles.pagination}>
                            <FocusButton
                                label="Previous"
                                variant="secondary"
                                disabled={page <= 1}
                                onPress={() => {
                                    scrollOffset.current = 0;
                                    focusedMediaId.current = null;
                                    setPage((current) => Math.max(1, current - 1));
                                    listRef.current?.scrollToOffset({offset: 0, animated: false});
                                }}
                            />
                            <Text style={styles.pageLabel}>
                                Page {library.data.pagination.page} of {library.data.pagination.totalPages}
                            </Text>
                            <FocusButton
                                label="Next"
                                variant="secondary"
                                disabled={page >= library.data.pagination.totalPages}
                                onPress={() => {
                                    scrollOffset.current = 0;
                                    focusedMediaId.current = null;
                                    setPage((current) => Math.min(library.data.pagination.totalPages, current + 1));
                                    listRef.current?.scrollToOffset({offset: 0, animated: false});
                                }}
                            />
                        </View>
                    ) : null
                }
                renderItem={({item}) => (
                    <MediaTile
                        server={server}
                        item={item}
                        hasTVPreferredFocus={item.id === preferredMediaId}
                        onFocusItem={focusMedia}
                        onOpen={openMedia}
                        onOpenActions={mediaDialogs.openActions}
                    />
                )}
            />

            <ActionMenu
                title="Watch status"
                visible={picker === "watch"}
                onClose={() => setPicker(null)}
                description="This choice is remembered separately for this collection."
                items={watchOptions.map((option) => ({
                    icon: CheckIcon,
                    key: option.value,
                    label: option.label,
                    selected: option.value === watch,
                    onPress: () => changeWatch(option.value),
                }))}
            />

            <ActionMenu
                title="Sort titles"
                visible={picker === "sort"}
                onClose={() => setPicker(null)}
                items={sortOptions.map((option) => ({
                    key: option.value,
                    label: option.label,
                    icon: ArrowUpDownIcon,
                    selected: option.value === sort,
                    onPress: () => changeSort(option.value),
                }))}
            />

            <MediaDialogs
                server={server}
                controller={mediaDialogs}
            />
        </View>
    )
}


const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingBottom: 54,
        paddingHorizontal: spacing.page,
    },
    listHeader: { marginBottom: 18 },
    titleRow: {
        gap: 20,
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    titleCopy: {
        flex: 1,
        gap: 5,
    },
    badge: {
        gap: 5,
        height: 24,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        alignSelf: "flex-start",
        backgroundColor: colors.surfaceRaised,
    },
    badgeText: { color: colors.text, fontSize: 11, fontWeight: "800" },
    heading: { color: colors.text, fontSize: 32, lineHeight: 37, fontWeight: "800", letterSpacing: -0.7 },
    description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    toolbar: { flexDirection: "row", alignItems: "center", gap: 8 },
    searchField: { width: 300, position: "relative" },
    searchIcon: { position: "absolute", left: 13, bottom: 13, zIndex: 2 },
    searchInput: { paddingLeft: 40, paddingRight: 48 },
    searchClear: { position: "absolute", right: 4, bottom: 4, zIndex: 2 },
    refreshing: { color: colors.muted, fontSize: 13, alignSelf: "flex-end", marginTop: 8 },
    gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
    loading: { minHeight: 220, alignItems: "center", justifyContent: "center" },
    empty: {
        minHeight: 190,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface
    },
    emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
    emptyDescription: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    error: { color: colors.danger, fontSize: 14, marginBottom: 10 },
    pagination: { marginTop: 24, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 20 },
    pageLabel: { color: colors.text, minWidth: 150, textAlign: "center", fontSize: 15, fontWeight: "700" },
})

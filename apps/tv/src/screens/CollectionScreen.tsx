import {libraryOptions, mediaFoldersOptions} from "../query-options";
import {colors, spacing} from "../theme";
import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {MediaTile} from "../components/MediaTile";
import {AppHeader} from "../components/AppHeader";
import {ActionMenu} from "../components/ActionMenu";
import {FocusButton} from "../components/FocusButton";
import {FocusIconButton} from "../components/FocusIconButton";
import {FocusTextInput} from "../components/FocusTextInput";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {MediaDialogs, useMediaDialogs} from "../components/MediaDialogs";
import {ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, View} from "react-native";
import {ArrowUpDownIcon, CheckIcon, FilmIcon, FilterIcon, SearchIcon, TvIcon, XIcon} from "lucide-react-native";
import {type MediaFolderSummary, type MediaSort, type MediaSummary, type MediaWatchFilter} from "@foyer/contracts";


const PAGE_SIZE = 50;

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


interface CollectionScreenProps {
    server: string;
    onHome: () => void;
    onOpenSettings: () => void;
    initialFolder: MediaFolderSummary;
    onOpenMedia: (item: MediaSummary) => void;
}


export function CollectionScreen({ server, initialFolder, onHome, onOpenMedia, onOpenSettings }: CollectionScreenProps) {
    const mediaDialogs = useMediaDialogs();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [sort, setSort] = useState<MediaSort>("recent");
    const [watch, setWatch] = useState<MediaWatchFilter>("all");
    const [picker, setPicker] = useState<"watch" | "sort" | null>(null);

    const folders = useQuery(mediaFoldersOptions(server));

    const folder = folders.data?.find((candidate) => candidate.id === initialFolder.id) ?? initialFolder;

    useEffect(() => {
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            onHome();
            return true;
        })

        return () => subscription.remove();
    }, [onHome]);

    useEffect(() => {
        void AsyncStorage.getItem(watchStorageKey(initialFolder.id)).then((value) => {
            if (value === "watched" || value === "unwatched" || value === "all") {
                setWatch(value);
            }
        });
    }, [initialFolder.id]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 350);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    const library = useQuery(libraryOptions(server, {
            page,
            sort,
            watch,
            pageSize: PAGE_SIZE,
            libraryId: folder.id,
            search: search || undefined,
    }));

    const changeWatch = (value: MediaWatchFilter) => {
        setWatch(value);
        setPage(1);
        setPicker(null);
        void AsyncStorage.setItem(watchStorageKey(folder.id), value);
    };

    const changeSort = (value: MediaSort) => {
        setSort(value);
        setPage(1);
        setPicker(null);
    };

    const TypeIcon = folder.kind === "movies" ? FilmIcon : TvIcon;
    const sortLabel = sortOptions.find((option) => option.value === sort)!.label;
    const watchLabel = watchOptions.find((option) => option.value === watch)!.label;

    return (
        <View style={styles.screen}>
            <AppHeader active="other" onHome={onHome} onSettings={onOpenSettings}/>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.titleRow}>
                    <View style={styles.titleCopy}>
                        <View style={styles.badge}>
                            <TypeIcon color={colors.text} size={16}/>
                            <Text style={styles.badgeText}>
                                {folder.kind === "movies" ? "Movies" : "TV shows"}
                            </Text>
                        </View>
                        <Text style={styles.heading}>
                            {folder.name}
                        </Text>
                        <Text style={styles.description}>
                            {library.data?.pagination.totalItems ?? folder.titleCount} titles
                        </Text>
                    </View>
                </View>

                <View style={styles.toolbar}>
                    <View style={styles.searchField}>
                        <SearchIcon color={colors.muted} size={20} style={styles.searchIcon}/>
                        <FocusTextInput
                            value={searchInput}
                            style={styles.searchInput}
                            onChangeText={setSearchInput}
                            label="Search this collection"
                            placeholder={`Search ${folder.name}…`}
                        />
                        {!!searchInput &&
                            <View style={styles.searchClear}>
                                <FocusIconButton
                                    icon={XIcon}
                                    label="Clear search"
                                    onPress={() => setSearchInput("")}
                                />
                            </View>
                        }
                    </View>
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

                {library.isFetching &&
                    <Text style={styles.refreshing}>
                        Refreshing...
                    </Text>
                }

                {library.isPending &&
                    <ActivityIndicator
                        size="large"
                        color={colors.primary}
                    />
                }

                {library.isError &&
                    <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>
                            Could not open this collection
                        </Text>
                        <Text style={styles.emptyDescription}>
                            {library.error.message}
                        </Text>
                    </View>
                }

                {!!library.data?.items.length &&
                    <View style={styles.grid}>
                        {library.data.items.map((item, index) =>
                            <MediaTile
                                item={item}
                                key={item.id}
                                hasTVPreferredFocus={index === 0}
                                onOpen={() => onOpenMedia(item)}
                                onOpenActions={() => mediaDialogs.openActions(item)}
                            />
                        )}
                    </View>
                }

                {(library.data && !library.data.items.length) &&
                    <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>
                            No matching titles
                        </Text>
                        <Text style={styles.emptyDescription}>
                            Try another search or watch-status filter.
                        </Text>
                    </View>
                }

                {library.data && library.data.pagination.totalPages > 1 &&
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
                            onPress={() => setPage((curr) => Math.min(library.data.pagination.totalPages, curr + 1))}
                        />
                    </View>
                }
            </ScrollView>

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
    titleRow: {
        gap: 20,
        marginTop: 8,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
    },
    titleCopy: {
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
    badgeText: { color: colors.text, fontSize: 9, fontWeight: "800" },
    heading: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8 },
    description: { color: colors.muted, fontSize: 11 },
    toolbar: { marginTop: 18, marginBottom: 18, flexDirection: "row", alignItems: "flex-end", gap: 9 },
    searchField: { flex: 1, maxWidth: 480, position: "relative" },
    searchIcon: { position: "absolute", left: 13, bottom: 14, zIndex: 2 },
    searchInput: { paddingLeft: 40, paddingRight: 48 },
    searchClear: { position: "absolute", right: 4, bottom: 4, zIndex: 2 },
    refreshing: { color: colors.muted, alignSelf: "flex-end", marginBottom: 8 },
    grid: { flexDirection: "row", flexWrap: "wrap" },
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
    emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
    emptyDescription: { color: colors.muted, fontSize: 12 },
    error: { color: colors.danger, fontSize: 13, marginBottom: 10 },
    pagination: { marginTop: 24, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 20 },
    pageLabel: { color: colors.text, minWidth: 150, textAlign: "center", fontSize: 15, fontWeight: "700" },
})

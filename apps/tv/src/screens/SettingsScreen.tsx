import {colors, spacing} from "../theme";
import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {AppHeader} from "../components/AppHeader";
import {FocusButton} from "../components/FocusButton";
import {useTvUpdater} from "../components/TvUpdateProvider";
import {FocusTextInput} from "../components/FocusTextInput";
import {LibraryFormDialog} from "../components/LibraryFormDialog";
import {LibraryRecord, MediaFolderSummary} from "@ploux/contracts";
import {CollectionActionsDialog} from "../components/CollectionActionsDialog";
import {useScanLibraryMutation, useTestConnectionMutation} from "../query-mutations";
import {libraryOptions, mediaFoldersOptions, settingsOptions} from "../query-options";
import {ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, View} from "react-native";
import {ArrowLeftIcon, CheckCircleIcon, DatabaseIcon, DownloadIcon, FilmIcon, FolderSyncIcon, PencilIcon, ServerIcon} from "lucide-react-native";


interface SettingsScreenProps {
    onBack: () => void,
    firstRun?: boolean,
    initialServer: string,
    onSave: (server: string) => Promise<void>,
}


export function SettingsScreen({ initialServer, onSave, onBack, firstRun = false }: SettingsScreenProps) {
    const [server, setServer] = useState(initialServer)
    const test = useTestConnectionMutation(server)
    const [saving, setSaving] = useState(false)

    const save = async () => {
        setSaving(true)
        try {
            await onSave(server.trim().replace(/\/+$/, ""))
        }
        finally {
            setSaving(false)
        }
    }

    if (firstRun) {
        return (
            <View style={styles.firstRunScreen}>
                <View style={styles.connectionPanel}>
                    <ServerIcon color={colors.primary} size={42}/>
                    <View style={styles.copy}>
                        <Text style={styles.eyebrow}>WELCOME TO PLOUX TV</Text>
                        <Text style={styles.connectionTitle}>Find your home server</Text>
                        <Text style={styles.description}>
                            Enter the LAN address of the computer running Ploux. A physical TV cannot use localhost.
                        </Text>
                    </View>
                    <ConnectionForm
                        server={server}
                        setServer={setServer}
                        test={test}
                        saving={saving}
                        save={save}
                        preferredFocus
                    />
                </View>
            </View>
        )
    }

    return (
        <SettingsDashboard
            server={initialServer}
            editedServer={server}
            setEditedServer={setServer}
            test={test}
            saving={saving}
            save={save}
            onBack={onBack}
        />
    )
}


function SettingsDashboard({ server, editedServer, setEditedServer, test, saving, save, onBack }: {
    server: string
    editedServer: string
    setEditedServer: (value: string) => void
    test: ReturnType<typeof useTestConnectionMutation>
    saving: boolean
    save: () => Promise<void>
    onBack: () => void
}) {
    const updater = useTvUpdater()
    const [editLibrary, setEditLibrary] = useState<LibraryRecord | null>(null)
    const [collectionActions, setCollectionActions] =
        useState<MediaFolderSummary | null>(null)
    const settings = useQuery(settingsOptions(server))
    const folders = useQuery(mediaFoldersOptions(server))
    const library = useQuery(libraryOptions(server, { page: 1, pageSize: 1 }))
    const scanAll = useScanLibraryMutation(server)

    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                onBack()
                return true
            }
        )
        return () => subscription.remove()
    }, [onBack])

    const openActions = (record: LibraryRecord) => {
        const folder = folders.data?.find((item) => item.id === record.id)
        setCollectionActions(
            folder ?? {
                id: record.id,
                name: record.name,
                path: record.path,
                kind: record.kind,
                titleCount: 0,
                posterPaths: [],
            }
        )
    }

    return (
        <View style={styles.screen}>
            <AppHeader active="settings" onHome={onBack} onSettings={() => undefined}/>
            <ScrollView contentContainerStyle={styles.content}>
                <FocusButton
                    label="Home"
                    icon={ArrowLeftIcon}
                    variant="ghost"
                    size="small"
                    onPress={onBack}
                    style={styles.back}
                />
                <View style={styles.settingsTitleRow}>
                    <View style={styles.copy}>
                        <Text style={styles.eyebrow}>PLOUX SERVER</Text>
                        <Text style={styles.heading}>Settings</Text>
                        <Text style={styles.description}>
                            Manage the server connection, collections, scans, and recent activity.
                        </Text>
                    </View>
                    <FocusButton
                        label={scanAll.isPending ? "Scanning…" : "Scan all collections"}
                        icon={FolderSyncIcon}
                        variant="secondary"
                        disabled={scanAll.isPending}
                        onPress={() => scanAll.mutate()}
                    />
                </View>

                <View style={styles.stats}>
                    <Stat icon={FilmIcon} label="Titles" value={library.data?.stats.titles}/>
                    <Stat icon={DatabaseIcon} label="Collections" value={settings.data?.libraries.length}/>
                    <Stat icon={DatabaseIcon} label="Unmatched" value={library.data?.stats.unmatched}/>
                    <Stat icon={DatabaseIcon} label="In progress" value={library.data?.stats.inProgress}/>
                </View>
                {scanAll.isError ? (
                    <Text style={styles.error}>{scanAll.error.message}</Text>
                ) : null}
                {scanAll.data?.scans.some((scan) => scan.status === "failed") ? (
                    <Text style={styles.error}>
                        {scanAll.data.scans.filter((scan) => scan.status === "failed").length} collections failed to scan; the others completed.
                    </Text>
                ) : null}

                <View style={styles.settingsSection}>
                    <View style={styles.updateRow}>
                        <View style={styles.copy}>
                            <Text style={styles.sectionTitle}>App updates</Text>
                            <Text style={styles.description}>
                                Ploux TV {updater.currentVersion} · build {updater.currentVersionCode || "development"}
                            </Text>
                            <Text
                                style={[
                                    styles.updateStatus,
                                    updater.status === "error" && styles.error,
                                ]}
                            >
                                {updateStatus(updater)}
                            </Text>
                        </View>
                        <FocusButton
                            label={
                                updater.update
                                    ? "View update"
                                    : updater.status === "checking"
                                        ? "Checking…"
                                        : "Check for updates"
                            }
                            icon={DownloadIcon}
                            variant="secondary"
                            disabled={!updater.supported || updater.status === "checking"}
                            onPress={() => {
                                if (updater.update) updater.showUpdate()
                                else void updater.checkForUpdates()
                            }}
                        />
                    </View>
                </View>

                <View style={styles.settingsSection}>
                    <View style={styles.copy}>
                        <Text style={styles.sectionTitle}>Collections</Text>
                        <Text style={styles.description}>
                            Create new collections from the web app. Removing one here never deletes its media files.
                        </Text>
                    </View>
                    {settings.isPending ? <ActivityIndicator color={colors.primary} size="large"/> : null}
                    {settings.isError ? <Text style={styles.error}>{settings.error.message}</Text> : null}
                    <View style={styles.libraryList}>
                        {settings.data?.libraries.map((record) => (
                            <View key={record.id} style={styles.libraryRow}>
                                <View style={styles.libraryCopy}>
                                    <Text style={styles.libraryName}>{record.name}</Text>
                                    <Text numberOfLines={1} style={styles.path}>{record.path}</Text>
                                </View>
                                <Text style={styles.kind}>{record.kind === "movies" ? "Movies" : "TV shows"}</Text>
                                <FocusButton
                                    label="Edit"
                                    icon={PencilIcon}
                                    variant="ghost"
                                    size="small"
                                    onPress={() => setEditLibrary(record)}
                                />
                                <FocusButton
                                    label="Manage"
                                    variant="secondary"
                                    size="small"
                                    onPress={() => openActions(record)}
                                />
                            </View>
                        ))}
                        {settings.data && !settings.data.libraries.length ? (
                            <Text style={styles.emptyText}>No collections have been added yet.</Text>
                        ) : null}
                    </View>
                </View>

                <View style={styles.settingsSection}>
                    <View style={styles.copy}>
                        <Text style={styles.sectionTitle}>Server connection</Text>
                        <Text style={styles.description}>
                            Change the Ploux server used by this TV.
                        </Text>
                    </View>
                    <View style={styles.connectionInline}>
                        <ConnectionForm
                            server={editedServer}
                            setServer={setEditedServer}
                            test={test}
                            saving={saving}
                            save={save}
                        />
                    </View>
                </View>

                <View style={styles.settingsSection}>
                    <View style={styles.copy}>
                        <Text style={styles.sectionTitle}>Recent scans</Text>
                        <Text style={styles.description}>The latest indexing jobs on this server.</Text>
                    </View>
                    <View style={styles.scanList}>
                        {settings.data?.scans.map((scan) => (
                            <View key={scan.id} style={styles.scanRow}>
                                <View style={styles.libraryCopy}>
                                    <Text style={styles.libraryName}>
                                        {scan.status === "completed"
                                            ? `${scan.filesSeen} files indexed`
                                            : scan.status === "running"
                                                ? "Scan in progress"
                                                : "Scan failed"}
                                    </Text>
                                    <Text style={styles.path}>
                                        {new Date(scan.startedAt).toLocaleString()} · {scan.titlesAdded} new titles · {scan.subtitlesFound} subtitles
                                    </Text>
                                </View>
                                <Text style={[styles.status, scan.status === "failed" && styles.statusFailed]}>{scan.status}</Text>
                            </View>
                        ))}
                        {settings.data && !settings.data.scans.length ? (
                            <Text style={styles.emptyText}>No scans have run yet.</Text>
                        ) : null}
                    </View>
                </View>
            </ScrollView>

            <LibraryFormDialog server={server} library={editLibrary} visible={editLibrary !== null} onClose={() => setEditLibrary(null)}/>
            <CollectionActionsDialog
                server={server}
                folder={collectionActions}
                visible={collectionActions !== null}
                onClose={() => setCollectionActions(null)}
            />
        </View>
    )
}


function updateStatus(updater: ReturnType<typeof useTvUpdater>) {
    if (!updater.supported) return "Update checks are enabled in signed release builds."
    if (updater.status === "checking") return "Checking the public release feed…"
    if (updater.status === "available" && updater.update) {
        return `Version ${updater.update.version} is ready to install.`
    }
    if (updater.status === "downloading") {
        return `Downloading… ${Math.round(updater.progress * 100)}%`
    }
    if (updater.status === "verifying") return "Verifying the downloaded APK…"
    if (updater.status === "installing") return "Waiting for Android’s installer…"
    if (updater.status === "up-to-date") return "This TV is up to date."
    if (updater.status === "error") return updater.error ?? "The update check failed."
    return "Checks automatically once a day when Ploux starts."
}


function ConnectionForm({ server, setServer, test, saving, save, preferredFocus = false }: {
    server: string
    setServer: (value: string) => void
    test: ReturnType<typeof useTestConnectionMutation>
    saving: boolean
    save: () => Promise<void>
    preferredFocus?: boolean
}) {
    return (
        <View style={styles.connectionForm}>
            <FocusTextInput
                label="Server URL"
                value={server}
                onChangeText={setServer}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.1.10:3000"
                hasTVPreferredFocus={preferredFocus}
            />
            {test.isSuccess ? <Text style={styles.success}>Connected to Ploux.</Text> : null}
            {test.isError ? <Text style={styles.error}>{test.error.message}</Text> : null}
            <View style={styles.actions}>
                <FocusButton
                    label={test.isPending ? "Testing…" : "Test connection"}
                    variant="secondary"
                    onPress={() => test.mutate()}
                    disabled={!server || test.isPending}
                />
                <FocusButton
                    label={saving ? "Saving…" : "Save connection"}
                    icon={CheckCircleIcon}
                    onPress={() => void save()}
                    disabled={!server || saving}
                />
            </View>
        </View>
    )
}


function Stat({ icon: Icon, label, value, }: {
    icon: typeof FilmIcon
    label: string
    value: number | undefined
}) {
    return (
        <View style={styles.stat}>
            <View style={styles.statHeader}>
                <Text style={styles.statLabel}>{label}</Text>
                <Icon color={colors.muted} size={18}/>
            </View>
            <Text style={styles.statValue}>{value ?? "—"}</Text>
        </View>
    )
}


const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    firstRunScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.page, paddingBottom: 56, gap: 28 },
    back: { alignSelf: "flex-start", marginTop: 6 },
    connectionPanel: { width: 620, padding: 32, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 18 },
    copy: { gap: 5 },
    eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
    connectionTitle: { color: colors.text, fontSize: 29, fontWeight: "800", letterSpacing: -0.5 },
    heading: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8 },
    description: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    settingsTitleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 20 },
    stats: { flexDirection: "row", gap: 10 },
    stat: { flex: 1, minHeight: 88, padding: 14, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 10 },
    statHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    statLabel: { color: colors.muted, fontSize: 10 },
    statValue: { color: colors.text, fontSize: 26, fontWeight: "800" },
    settingsSection: { padding: 18, gap: 15, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    updateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 },
    updateStatus: { color: colors.muted, fontSize: 11, lineHeight: 16 },
    sectionTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
    libraryList: { gap: 6 },
    libraryRow: { minHeight: 58, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 9, backgroundColor: colors.surfaceRaised },
    libraryCopy: { flex: 1, gap: 3 },
    libraryName: { color: colors.text, fontSize: 13, fontWeight: "800" },
    path: { color: colors.muted, fontSize: 9 },
    kind: { color: colors.text, fontSize: 9, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.background },
    connectionInline: { maxWidth: 850 },
    connectionForm: { gap: 10 },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 9 },
    success: { color: colors.success, fontSize: 11, fontWeight: "700" },
    error: { color: colors.danger, fontSize: 11 },
    scanList: { gap: 6 },
    scanRow: { minHeight: 54, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 9, backgroundColor: colors.surfaceRaised },
    status: { color: colors.primary, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
    statusFailed: { color: colors.danger },
    emptyText: { color: colors.muted, textAlign: "center", paddingVertical: 30 },
});

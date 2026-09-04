import AsyncStorage from "@react-native-async-storage/async-storage"
import { DownloadIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react-native"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native"

import {
  currentTvVersion,
  currentTvVersionCode,
  downloadTvUpdate,
  findLatestTvUpdate,
  launchTvUpdateInstaller,
  openUnknownSourcesSettings,
  type TvUpdate,
} from "../updates"
import { colors } from "../theme"
import { FocusButton } from "./FocusButton"
import { TvModal } from "./TvModal"

const lastCheckKey = "foyer.tv-updates.last-check"
const dismissedVersionKey = "foyer.tv-updates.dismissed-version"
const automaticCheckInterval = 24 * 60 * 60 * 1000

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "verifying"
  | "installing"
  | "up-to-date"
  | "error"

type UpdateContextValue = {
  supported: boolean
  status: UpdateStatus
  update: TvUpdate | null
  progress: number
  error: string | null
  currentVersion: string
  currentVersionCode: number
  checkForUpdates: () => Promise<void>
  showUpdate: () => void
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The update failed"
}

export function TvUpdateProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) {
  const supported = Platform.OS === "android" && !__DEV__
  const [status, setStatus] = useState<UpdateStatus>("idle")
  const [update, setUpdate] = useState<TvUpdate | null>(null)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [canOpenInstallSettings, setCanOpenInstallSettings] = useState(false)
  const checking = useRef(false)
  const downloadedApk = useRef<{
    versionCode: number
    file: Awaited<ReturnType<typeof downloadTvUpdate>>
  } | null>(null)

  const check = useCallback(
    async (manual: boolean) => {
      if (!supported || checking.current) return
      checking.current = true
      setStatus("checking")
      setError(null)

      try {
        const latest = await findLatestTvUpdate()
        await AsyncStorage.setItem(lastCheckKey, String(Date.now()))
        setUpdate(latest)

        if (!latest) {
          setStatus("up-to-date")
          return
        }

        setStatus("available")
        if (manual) setDialogVisible(true)
      } catch (caught) {
        setStatus("error")
        setError(errorMessage(caught))
      } finally {
        checking.current = false
      }
    },
    [supported]
  )

  const checkForUpdates = useCallback(() => check(true), [check])

  useEffect(() => {
    if (!enabled || !supported) return

    const timeout = setTimeout(() => {
      void AsyncStorage.getItem(lastCheckKey).then((lastCheck) => {
        const lastCheckAt = Number(lastCheck ?? "0")
        if (Date.now() - lastCheckAt >= automaticCheckInterval) {
          void check(false)
        }
      })
    }, 2500)

    return () => clearTimeout(timeout)
  }, [check, enabled, supported])

  useEffect(() => {
    if (!enabled || !supported || status !== "available" || !update) return

    void AsyncStorage.getItem(dismissedVersionKey).then((dismissed) => {
      if (dismissed !== String(update.versionCode)) setDialogVisible(true)
    })
  }, [enabled, status, supported, update])

  const dismiss = async () => {
    setDialogVisible(false)
    if (update && status === "available") {
      await AsyncStorage.setItem(
        dismissedVersionKey,
        String(update.versionCode)
      )
    }
  }

  const install = async () => {
    if (!update) return

    setDialogVisible(true)
    setError(null)
    setCanOpenInstallSettings(false)

    try {
      if (
        downloadedApk.current?.versionCode !== update.versionCode ||
        !downloadedApk.current.file.exists
      ) {
        setProgress(0)
        setStatus("downloading")
        downloadedApk.current = {
          versionCode: update.versionCode,
          file: await downloadTvUpdate(update, setProgress, () =>
            setStatus("verifying")
          ),
        }
      }
    } catch (caught) {
      setStatus("error")
      setError(errorMessage(caught))
      return
    }

    try {
      setStatus("installing")
      await launchTvUpdateInstaller(downloadedApk.current.file)
      setStatus("available")
    } catch (caught) {
      setCanOpenInstallSettings(true)
      setStatus("error")
      setError(
        `${errorMessage(caught)}. Allow Foyer TV to install unknown apps, then try again.`
      )
    }
  }

  const value: UpdateContextValue = {
    supported,
    status,
    update,
    progress,
    error,
    currentVersion: currentTvVersion,
    currentVersionCode: currentTvVersionCode,
    checkForUpdates,
    showUpdate: () => setDialogVisible(true),
  }

  const busy =
    status === "downloading" ||
    status === "verifying" ||
    status === "installing"

  return (
    <UpdateContext.Provider value={value}>
      {children}
      <TvModal
        visible={dialogVisible && update !== null}
        title="Foyer TV update"
        description={
          update
            ? `${currentTvVersion} → ${update.version} · ${(update.size / 1_000_000).toFixed(1)} MB`
            : undefined
        }
        onClose={() => {
          if (!busy) void dismiss()
        }}
        width={540}
        dismissible={!busy}
      >
        <View style={styles.dialogBody}>
          {status === "downloading" ? (
            <>
              <View style={styles.phaseRow}>
                <DownloadIcon color={colors.primary} size={22} />
                <Text style={styles.phaseTitle}>
                  Downloading… {Math.round(progress * 100)}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progress * 100}%` }]}
                />
              </View>
            </>
          ) : status === "verifying" ? (
            <View style={styles.phaseRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.phaseTitle}>Verifying the APK…</Text>
            </View>
          ) : status === "installing" ? (
            <View style={styles.phaseRow}>
              <ShieldCheckIcon color={colors.primary} size={22} />
              <Text style={styles.phaseTitle}>
                Confirm the update in Android’s installer.
              </Text>
            </View>
          ) : (
            <Text style={styles.message}>
              {status === "error"
                ? error
                : "A newer signed version is ready. Android will ask you to confirm the installation."}
            </Text>
          )}

          <View style={styles.actions}>
            {!busy ? (
              <FocusButton
                label="Later"
                variant="ghost"
                size="small"
                onPress={() => void dismiss()}
              />
            ) : null}
            {status === "error" && canOpenInstallSettings ? (
              <FocusButton
                label="Allow installs"
                variant="secondary"
                size="small"
                onPress={() => void openUnknownSourcesSettings()}
              />
            ) : null}
            {!busy ? (
              <FocusButton
                label={status === "error" ? "Try again" : "Install update"}
                icon={status === "error" ? RefreshCwIcon : DownloadIcon}
                size="small"
                hasTVPreferredFocus
                onPress={() => void install()}
              />
            ) : null}
          </View>
        </View>
      </TvModal>
    </UpdateContext.Provider>
  )
}

export function useTvUpdater() {
  const value = useContext(UpdateContext)
  if (!value) throw new Error("useTvUpdater must be used inside TvUpdateProvider")
  return value
}

const styles = StyleSheet.create({
  dialogBody: { gap: 18 },
  phaseRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  phaseTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "800" },
  message: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  progressTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: colors.background,
  },
  progressFill: { height: "100%", backgroundColor: colors.primary },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
})

import * as Application from "expo-application"
import { File, Paths } from "expo-file-system"
import { getContentUriAsync } from "expo-file-system/legacy"
import * as IntentLauncher from "expo-intent-launcher"
import ReactNativeBlobUtil from "react-native-blob-util"

const repository =
  process.env.EXPO_PUBLIC_FOYER_TV_REPOSITORY ?? "vincedelmas/foyer"
const releasesUrl = `https://api.github.com/repos/${repository}/releases?per_page=20`
const apkMimeType = "application/vnd.android.package-archive"
const installerFlags = 0x10000001
const canonicalReleaseTagPattern = /^v\d+\.\d+\.\d+$/

type GithubAsset = {
  name: string
  browser_download_url: string
}

type GithubRelease = {
  tag_name: string
  draft: boolean
  prerelease: boolean
  assets: GithubAsset[]
}

export type TvUpdate = {
  schemaVersion: 1
  version: string
  versionCode: number
  apkUrl: string
  sha256: string
  size: number
  publishedAt: string
}

export const currentTvVersion =
  Application.nativeApplicationVersion ?? "development"
export const currentTvVersionCode = Number(
  Application.nativeBuildVersion ?? "0"
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isGithubRelease(value: unknown): value is GithubRelease {
  return (
    isRecord(value) &&
    typeof value.tag_name === "string" &&
    typeof value.draft === "boolean" &&
    typeof value.prerelease === "boolean" &&
    Array.isArray(value.assets) &&
    value.assets.every(
      (asset) =>
        isRecord(asset) &&
        typeof asset.name === "string" &&
        typeof asset.browser_download_url === "string"
    )
  )
}

function isTvUpdate(value: unknown): value is TvUpdate {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.version !== "string" ||
    typeof value.versionCode !== "number" ||
    !Number.isSafeInteger(value.versionCode) ||
    typeof value.apkUrl !== "string" ||
    typeof value.sha256 !== "string" ||
    typeof value.size !== "number" ||
    !Number.isSafeInteger(value.size) ||
    typeof value.publishedAt !== "string"
  ) {
    return false
  }

  if (!/^\d+\.\d+\.\d+$/.test(value.version)) return false

  let apkUrl: URL
  try {
    apkUrl = new URL(value.apkUrl)
  } catch {
    return false
  }

  return (
    value.versionCode > 0 &&
    value.size > 0 &&
    /^[a-f\d]{64}$/i.test(value.sha256) &&
    apkUrl.protocol === "https:" &&
    apkUrl.hostname === "github.com" &&
    apkUrl.pathname ===
      `/${repository}/releases/download/v${value.version}/foyer-tv.apk`
  )
}

async function responseJson(response: Response, label: string) {
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status})`)
  }
  return (await response.json()) as unknown
}

export async function findLatestTvUpdate(): Promise<TvUpdate | null> {
  const releasesPayload = await responseJson(
    await fetch(releasesUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }),
    "Update check"
  )

  if (!Array.isArray(releasesPayload)) {
    throw new Error("GitHub returned an invalid releases response")
  }

  const releases = releasesPayload.filter(isGithubRelease).filter(
    (candidate) =>
      !candidate.draft &&
      !candidate.prerelease &&
      canonicalReleaseTagPattern.test(candidate.tag_name) &&
      candidate.assets.some((asset) => asset.name === "update.json")
  )
  const release = releases[0]
  if (!release) return null

  const manifestAsset = release.assets.find(
    (asset) => asset.name === "update.json"
  )
  if (!manifestAsset) {
    throw new Error(`Release ${release.tag_name} has no update manifest`)
  }

  const manifest = await responseJson(
    await fetch(manifestAsset.browser_download_url),
    "Update manifest download"
  )
  if (!isTvUpdate(manifest)) {
    throw new Error("The update manifest is invalid")
  }
  if (release.tag_name !== `v${manifest.version}`) {
    throw new Error("The update manifest version does not match its release")
  }
  const apkUrl = new URL(manifest.apkUrl)
  if (
    apkUrl.pathname !==
    `/${repository}/releases/download/${release.tag_name}/foyer-tv.apk`
  ) {
    throw new Error("The update APK does not belong to its release")
  }

  return manifest.versionCode > currentTvVersionCode ? manifest : null
}

export async function downloadTvUpdate(
  update: TvUpdate,
  onProgress: (progress: number) => void,
  onVerifying: () => void
) {
  const destination = new File(Paths.cache, "foyer-tv-update.apk")
  if (destination.exists) destination.delete()

  const downloaded = await File.downloadFileAsync(update.apkUrl, destination, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      const total = totalBytes > 0 ? totalBytes : update.size
      onProgress(Math.min(1, bytesWritten / total))
    },
  })

  if (downloaded.size !== update.size) {
    downloaded.delete()
    throw new Error("The downloaded APK has an unexpected size")
  }

  onVerifying()
  const digest = await ReactNativeBlobUtil.fs.hash(downloaded.uri, "sha256")

  if (digest.toLowerCase() !== update.sha256.toLowerCase()) {
    downloaded.delete()
    throw new Error("The downloaded APK failed its SHA-256 check")
  }

  return downloaded
}

export async function launchTvUpdateInstaller(apk: File) {
  const contentUri = await getContentUriAsync(apk.uri)
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    flags: installerFlags,
    type: apkMimeType,
  })
}

export async function openUnknownSourcesSettings() {
  const applicationId = Application.applicationId ?? "com.foyer.tv"
  await IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
    { data: `package:${applicationId}` }
  )
}

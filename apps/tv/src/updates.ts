import * as Application from "expo-application"
import * as Crypto from "expo-crypto"
import { File, Paths } from "expo-file-system"
import { getContentUriAsync } from "expo-file-system/legacy"
import * as IntentLauncher from "expo-intent-launcher"

const repository =
  process.env.EXPO_PUBLIC_PLOUX_TV_REPOSITORY ?? "vincedelmas/ploux"
const releasesUrl = `https://api.github.com/repos/${repository}/releases?per_page=20`
const apkMimeType = "application/vnd.android.package-archive"
const installerFlags = 0x10000001

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

  const apkUrl = new URL(value.apkUrl)
  return (
    value.versionCode > 0 &&
    value.size > 0 &&
    /^[a-f\d]{64}$/i.test(value.sha256) &&
    apkUrl.protocol === "https:" &&
    apkUrl.hostname === "github.com" &&
    apkUrl.pathname.startsWith(`/${repository}/releases/download/tv-v`)
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

  const release = releasesPayload
    .filter(isGithubRelease)
    .find(
      (candidate) =>
        !candidate.draft &&
        !candidate.prerelease &&
        candidate.tag_name.startsWith("tv-v")
    )
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

  return manifest.versionCode > currentTvVersionCode ? manifest : null
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export async function downloadTvUpdate(
  update: TvUpdate,
  onProgress: (progress: number) => void,
  onVerifying: () => void
) {
  const destination = new File(Paths.cache, "ploux-tv-update.apk")
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
  let bytes = await downloaded.bytes()
  const digest = hex(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)
  )
  bytes = new Uint8Array(0)

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
  const applicationId = Application.applicationId ?? "com.ploux.tv"
  await IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
    { data: `package:${applicationId}` }
  )
}

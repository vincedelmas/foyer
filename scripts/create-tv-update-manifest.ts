import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { stat, writeFile } from "node:fs/promises"

const [apkPath, manifestPath] = process.argv.slice(2)
const version = process.env.FOYER_TV_VERSION
const versionCode = Number(process.env.FOYER_TV_VERSION_CODE)
const repository = process.env.GITHUB_REPOSITORY
const releaseTag = process.env.FOYER_TV_RELEASE_TAG

if (!apkPath || !manifestPath || !version || !repository || !releaseTag) {
  throw new Error(
    "Usage: create-tv-update-manifest.ts <apk> <manifest>; release environment is required"
  )
}

if (!Number.isSafeInteger(versionCode) || versionCode < 1) {
  throw new Error("FOYER_TV_VERSION_CODE must be a positive integer")
}

const hash = createHash("sha256")
for await (const chunk of createReadStream(apkPath)) hash.update(chunk)

const sha256 = hash.digest("hex")
const { size } = await stat(apkPath)
const assetBase = `https://github.com/${repository}/releases/download/${encodeURIComponent(releaseTag)}`
const manifest = {
  schemaVersion: 1,
  version,
  versionCode,
  apkUrl: `${assetBase}/foyer-tv.apk`,
  sha256,
  size,
  publishedAt: new Date().toISOString(),
}

await Promise.all([
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(`${apkPath}.sha256`, `${sha256}  foyer-tv.apk\n`),
])

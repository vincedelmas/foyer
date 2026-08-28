import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { stat, writeFile } from "node:fs/promises"

const [apkPath, manifestPath] = process.argv.slice(2)
const version = process.env.PLOUX_TV_VERSION
const versionCode = Number(process.env.PLOUX_TV_VERSION_CODE)
const repository = process.env.GITHUB_REPOSITORY

if (!apkPath || !manifestPath || !version || !repository) {
  throw new Error(
    "Usage: create-tv-update-manifest.ts <apk> <manifest>; PLOUX_TV_VERSION and GITHUB_REPOSITORY are required"
  )
}

if (!Number.isSafeInteger(versionCode) || versionCode < 1) {
  throw new Error("PLOUX_TV_VERSION_CODE must be a positive integer")
}

const hash = createHash("sha256")
for await (const chunk of createReadStream(apkPath)) hash.update(chunk)

const sha256 = hash.digest("hex")
const { size } = await stat(apkPath)
const tag = `tv-v${version}`
const assetBase = `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}`
const manifest = {
  schemaVersion: 1,
  version,
  versionCode,
  apkUrl: `${assetBase}/ploux-tv.apk`,
  sha256,
  size,
  publishedAt: new Date().toISOString(),
}

await Promise.all([
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(`${apkPath}.sha256`, `${sha256}  ploux-tv.apk\n`),
])

import type { ConfigContext, ExpoConfig } from "expo/config"

function versionCode(fallback: number) {
  const configured = process.env.FOYER_TV_VERSION_CODE
  if (!configured) return fallback

  const parsed = Number(configured)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("FOYER_TV_VERSION_CODE must be a positive integer")
  }

  return parsed
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Foyer TV",
  slug: config.slug ?? "foyer-tv",
  version: process.env.FOYER_TV_VERSION ?? config.version ?? "0.1.0",
  android: {
    ...config.android,
    versionCode: versionCode(config.android?.versionCode ?? 1),
  },
})

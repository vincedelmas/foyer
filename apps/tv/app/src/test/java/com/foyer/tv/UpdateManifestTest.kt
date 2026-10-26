package com.foyer.tv

import org.junit.Assert.*
import org.junit.Test

class UpdateManifestTest {
    private val manifest =
        TvUpdate(
            1,
            "1.5.0",
            1005000,
            "https://github.com/vincedelmas/foyer/releases/download/v1.5.0/foyer-tv.apk",
            "a".repeat(64),
            32_000_000,
            "2026-10-26T10:00:00Z",
        )

    @Test
    fun `canonical releases use the existing updater format`() {
        val json = Api.json.encodeToString(TvUpdate.serializer(), manifest)
        Api.json.decodeFromString<TvUpdate>(json).validate("vincedelmas/foyer", "v1.5.0")
    }

    @Test
    fun `invalid or substituted update assets are rejected`() {
        listOf(
                manifest.copy(schemaVersion = 2),
                manifest.copy(size = 0),
                manifest.copy(versionCode = 0),
                manifest.copy(sha256 = "bad"),
                manifest.copy(version = "1.5.0-beta"),
                manifest.copy(apkUrl = "https://example.com/foyer-tv.apk"),
                manifest.copy(
                    apkUrl = manifest.apkUrl.replace("vincedelmas/foyer", "another/project")
                ),
                manifest.copy(apkUrl = manifest.apkUrl.replace("v1.5.0/", "v1.4.1/")),
            )
            .forEach {
                assertTrue(runCatching { it.validate("vincedelmas/foyer", "v1.5.0") }.isFailure)
            }
    }
}

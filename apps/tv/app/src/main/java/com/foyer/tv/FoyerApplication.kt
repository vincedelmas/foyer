package com.foyer.tv

import android.app.Application
import android.database.sqlite.SQLiteDatabase
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache

class FoyerApplication : Application(), ImageLoaderFactory {
    val preferences by lazy { getSharedPreferences("foyer", MODE_PRIVATE) }

    override fun onCreate() {
        super.onCreate()
        if (!preferences.getBoolean("native-import-complete", false)) {
            val legacy = getDatabasePath("RKStorage")
            val editor = preferences.edit()
            if (legacy.exists()) {
                SQLiteDatabase.openDatabase(legacy.path, null, SQLiteDatabase.OPEN_READONLY).use {
                    db ->
                    db.query(
                            "catalystLocalStorage",
                            arrayOf("key", "value"),
                            null,
                            null,
                            null,
                            null,
                            null,
                        )
                        .use { rows ->
                            while (rows.moveToNext()) {
                                val key = rows.getString(0)
                                if (
                                    key == "foyer.server-url" ||
                                        key.startsWith("foyer.tv.watch-filter.") ||
                                        key.startsWith("foyer.tv-updates.")
                                ) {
                                    editor.putString(key, rows.getString(1))
                                }
                            }
                        }
                }
            }
            editor.putBoolean("native-import-complete", true).apply()
        }
    }

    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this)
            .memoryCache { MemoryCache.Builder(this).maxSizePercent(0.08).build() }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("artwork"))
                    .maxSizeBytes(128L * 1024 * 1024)
                    .build()
            }
            .crossfade(false)
            .build()
}

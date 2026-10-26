package com.foyer.tv

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class PreferenceMigrationTest {
    @Test
    fun `RN upgrade preserves the server watched filters and update state exactly once`() {
        val application = ApplicationProvider.getApplicationContext<FoyerApplication>()
        val preferences = application.getSharedPreferences("foyer", Context.MODE_PRIVATE)
        preferences.edit().clear().commit()
        val database = application.getDatabasePath("RKStorage")
        database.parentFile!!.mkdirs()
        SQLiteDatabase.openOrCreateDatabase(database, null).use { db ->
            db.execSQL(
                "CREATE TABLE catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )
            mapOf(
                    "foyer.server-url" to "http://192.168.1.10:3000",
                    "foyer.tv.watch-filter.movies" to "unwatched",
                    "foyer.tv-updates.last-check" to "123456789",
                    "foyer.tv-updates.dismissed-version" to "1004001",
                )
                .forEach { (key, value) ->
                    db.execSQL(
                        "INSERT INTO catalystLocalStorage VALUES (?, ?)",
                        arrayOf(key, value),
                    )
                }
        }
        application.onCreate()
        assertEquals("http://192.168.1.10:3000", preferences.getString("foyer.server-url", null))
        assertEquals("unwatched", preferences.getString("foyer.tv.watch-filter.movies", null))
        assertEquals("123456789", preferences.getString("foyer.tv-updates.last-check", null))
        assertEquals("1004001", preferences.getString("foyer.tv-updates.dismissed-version", null))
        preferences.edit().putString("foyer.server-url", "http://192.168.1.11:3000").commit()
        application.onCreate()
        assertEquals("http://192.168.1.11:3000", preferences.getString("foyer.server-url", null))
    }
}

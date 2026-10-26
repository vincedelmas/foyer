# Native Android TV client

`apps/tv` is a standalone Kotlin / Jetpack Compose for TV application for the NVIDIA Shield TV 2019 Tube. It requires Android 11 (API 30), packages only `armeabi-v7a`, and connects to the existing LAN JSON API. The server and web app are unchanged.

## Structure

- `app/src/main/java/com/foyer/tv`: Compose screens/dialogs, API models/client, navigation, native preferences, and the APK updater.
- `app/src/main/java/com/foyer/player`: the existing Kotlin Media3 player, moved out of its Expo module. The playback engine is retained; the system UI code now uses the Android 11 API directly.
- `app/src/test`: API/playlist contracts, update validation, preference migration, and Android 11 browsing/navigation checks.
- `app/build.gradle.kts`: Android/ABI selection, dependencies, signing, and release optimization.

API models mirror `packages/contracts/src/index.ts`. Keep them in sync when changing the JSON API. Successful mutations invalidate the native request cache; returning from playback saves the final position before refreshing the catalog. Artwork uses bounded memory and disk caches, and collections prefetch the next page and its posters.

Build from `apps/tv` itself with the checked-in Gradle wrapper. No generated platform project is needed.

## Feature parity

The native app includes:

- First-run server setup, connection test, and saved LAN address.
- Continue watching and collection shelves, poster art, watched badges, remaining-episode counts, and long-press action menus.
- Collection search, all eight sorts, persisted per-collection watch filters, 50-title pagination, next-page prefetch, and saved focus/scroll/browse state when returning from details or settings.
- Title details, resume/play, seasons (including specials), episode/file pagination, watched actions for titles/seasons/parts, progress clearing, metadata, and cast artwork.
- Metadata search with optional year, manual identification, metadata refresh, and lazy technical stream inspection with retries and external subtitle details.
- Collection creation/editing, scan/rescan, collection-wide metadata refresh, removal, overall statistics, and recent scan results.
- Explicit confirmation before source-file deletion or collection removal. These remain distinct API operations.
- The existing Media3 1.8.0 player, local FFmpeg audio fallback, libass ASS/SSA styling, embedded/external subtitles, audio/subtitle pickers, media session/remote keys, seek controls, playlist transitions, resume, progress reporting, and player lifecycle behavior.
- Unfiltered playback playlists across all seasons/pages and the existing `compat=android-tv` stream/subtitle URLs (including server AVI remux support).
- Daily and manual update checks, remembered dismissals, download progress, streaming size/SHA-256 verification, install permission settings, and Android's installer.
- A one-time import of the old AsyncStorage server, watch filters, and update state. All media/progress data remains on the server.

## Verification

Run with JDK 17 and Android SDK platform 36 / build tools 35.0.0:

```bash
cd apps/tv
./gradlew testDebugUnitTest lintDebug lintRelease assembleDebug assembleRelease
```

Debug installs use `com.foyer.tv.debug`; release installs retain `com.foyer.tv`. Without release signing variables, `assembleRelease` produces an unsigned APK for inspection. See [release setup](android-tv-releases.md) for permanent signing.

Automated checks cannot confirm real Shield decoder, HDMI, or remote behavior. Before publishing the first migration release, verify on the Tube:

1. Install the old permanently signed release, set a server/filter/update dismissal, then install the new APK with the same key and a greater version code. Verify preferences survive and the next update installs successfully.
2. Use the remote to navigate shelves, long-press menus, search/clear/Back, every filter/sort, and multiple collection pages. Open details/settings and return to the same title, focus, and scroll position.
3. Browse a series with multiple seasons and over 50 episodes, including season 0. Verify resume selects the correct continuation page and playback continues across page/season boundaries.
4. Exercise title/season/episode watched actions and progress clearing, then check the home and collection views refresh.
5. Identify/refresh metadata, inspect files/streams, edit/scan/remove a collection, and verify partial scan errors are shown. Use disposable media to test the explicit permanent deletion confirmation.
6. Play representative H.264/HEVC/MKV/MP4/AVI files, AC3/E-AC3/DTS audio, embedded/external SRT/VTT/ASS/SSA subtitles, and styled anime subtitles. Test track switching, seeking, previous/next, completion, Home/relaunch, sleep/resume, and Back.
7. Verify updates: manual/daily checks, Later, download progress, checksum failure handling, unknown-source permission, installer cancellation, and successful installation.

The hardware checklist records validation still needed on the actual supported device; it does not imply hardware tests were run by the build.

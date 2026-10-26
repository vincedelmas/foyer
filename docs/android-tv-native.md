# Android TV

The app is made for the **NVIDIA Shield TV 2019 Tube**. It needs Android 11. The APK is 32-bit ARM only.
The code is in `apps/tv`. It uses Kotlin and Compose for TV. The player uses Media3, FFmpeg for audio, and libass for subtitles.

## Build

Install JDK 17 and the Android SDK. You need platform 36 and build tools 35.0.0.
Set `JAVA_HOME` and `ANDROID_HOME`. You do not need Bun or Node.js.

```bash
cd apps/tv
./gradlew installDebug
```

This installs a separate dev app. It does not replace the signed app on your TV.

## Checks

From `apps/tv`:

```bash
./gradlew testReleaseUnitTest lintRelease
```

Before a release, also check on the Shield:

- Move around with the remote. Try search, menus, and Back.
- Play files. Try audio tracks, subtitles, seeking, and the next episode.
- Check resume, watched status, and browsing across seasons and pages.
- Install an update over the old app. Check that settings stay saved.

See the [release guide](android-tv-releases.md) to build and publish an update.

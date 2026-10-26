# Foyer

Your movies and TV shows, at home.
I made Foyer for my own home network. Add your media folders. Let it find the posters. Then watch your files in a browser or on Android TV.

## About the code

- The web app was built with help from AI agents.
- The Android TV app was fully vibe coded with **gpt-6.1-sol**.

I want to be clear about how this project was made.

## What it does

- Movies, TV shows, and anime collections.
- Posters and title details from TMDB.
- Manual search when Foyer finds the wrong title.
- Watch progress and watched status.
- SRT, VTT, ASS, and SSA subtitles.
- Collection scans and media file details.
- File deletion, with a confirmation first.

Foyer plays the original files. It does not convert video or audio on the server. Your device needs to support the file format.
There are no accounts, plugins, live TV, or sharing features. This is a small app for home use.

**Use it on your local network. There is no login. Do not expose it to the public internet.**

## Start the server

You need [Bun 1.4 or newer](https://bun.sh/).

```bash
git clone https://github.com/vincedelmas/foyer.git
cd foyer
cp .env.example .env
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

Go to **Settings**. Add a folder path from the machine running Foyer.
Use a full path, like `/srv/media/movies`. Then scan the folder.
For posters and title details, add a [TMDB read access token](https://www.themoviedb.org/settings/api) to `.env`:

```dotenv
TMDB_READ_ACCESS_TOKEN=your_token
```

You can use Foyer without this token. It will not download TMDB data.

Install FFmpeg if you want file details and AVI playback support on the TV.
Foyer needs both `ffmpeg` and `ffprobe` in your `PATH`.
AVI support changes the file container, but does not convert the video or audio.

The database is saved in `data/foyer.sqlite`. See [.env.example](.env.example) for the other settings.

## Name your files

Put movies in one folder or in their own folders. Add the year when you can.

```text
/media/movies/Perfect Days.2023.mkv
/media/movies/Dune Part Two (2024)/Dune.Part.Two.2024.mp4
```

For TV shows, use the show name and episode number.

```text
/media/series/The Bear/Season 03/The.Bear.S03E01.mkv
```

Foyer also reads episode names like `1x02` and anime names ending in ` - 02`.
Put subtitle files next to the video. Start with the same file name.

```text
The.Bear.S03E01.mkv
The.Bear.S03E01.en.srt
The.Bear.S03E01.fr.default.ass
```

## Android TV

The TV app is made for the **NVIDIA Shield TV 2019 Tube**. It needs Android 11. The APK is **32-bit ARM only**.
Download `foyer-tv.apk` from [Releases](https://github.com/vincedelmas/foyer/releases).

Install it on your TV. On first launch, enter the server's local address. For example: `http://192.168.1.10:3000`.
You can get the next version from **Settings → App updates**. Updates use Android's install screen.

The app was created in Kotlin and Compose for TV.
To build it yourself, install JDK 17 and the Android SDK.
You need platform 36 and build tools 35.0.0. Set `JAVA_HOME` and `ANDROID_HOME`.

```bash
cd apps/tv
./gradlew installDebug
```

This installs a separate dev app. For release builds and signing, see the [TV release guide](docs/android-tv-releases.md).
More TV details: [features and device checks](docs/android-tv-native.md), [third-party licenses](apps/tv/THIRD_PARTY_NOTICES.md).

## Run a production build

```bash
bun run build
bun run start
```

The server uses port `3000` by default.

## Checks

Web and server:

```bash
bun run typecheck
bun run lint
bun run test
```

Android TV:

```bash
cd apps/tv
./gradlew testReleaseUnitTest lintRelease
```

Foyer uses the TMDB API. TMDB does not endorse or certify this project.

# Ploux

Ploux is the home media server I wanted for myself: point it at a few folders, let it find the artwork, and watch the original files from a browser or Android TV.

It is intentionally small and opinionated. There are no accounts, plugins, live TV, sharing features, or server-side transcoding. If you need a full Plex or Jellyfin replacement, this probably is not it. If you want a simple direct-play library for a trusted home network, it may be useful to you too.

## What it does

- Scans movie, series, and anime folders into separate collections
- Matches titles against TMDB, with manual identify and refresh tools when a match is wrong
- Streams the original files with HTTP range support for seeking
- Remembers playback position and watched status
- Finds external SRT, VTT, ASS, and SSA subtitles next to a video
- Provides a web app and a D-pad-friendly Android TV app
- Shows detailed codec and stream information when `ffprobe` is available
- Can permanently delete a title's source files, but only after explicit confirmation

## Getting started

You need [Bun 1.4 or newer](https://bun.sh/). A [TMDB v4 read access token](https://www.themoviedb.org/settings/api) is optional, but without one Ploux cannot download titles, posters, or other metadata.

```bash
git clone https://github.com/vincedelmas/ploux.git
cd ploux
cp .env.example .env
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), go to **Settings**, add an absolute path from the machine running Ploux, and scan it. SQLite data is stored in `./data/ploux.sqlite` by default, and migrations run automatically.

For optional stream inspection and Android TV compatibility remuxing, install FFmpeg so that both `ffmpeg` and `ffprobe` are on your `PATH`.

### Configuration

The defaults in `.env.example` are enough for a local setup.

| Variable | What it changes |
| --- | --- |
| `TMDB_READ_ACCESS_TOKEN` | Enables automatic and manual TMDB matching |
| `PLOUX_DATABASE_PATH` | SQLite database path; defaults to `./data/ploux.sqlite` |
| `PLOUX_CACHE_PATH` | Cache used for Android TV AVI remuxes; defaults to `./data/cache` |
| `PLOUX_CORS_ORIGIN` | Allows one separate browser origin; the built-in web app and TV app do not need it |
| `HOST` | Production bind address; defaults to `0.0.0.0` |
| `PORT` | Production port; defaults to `3000` |

## Organizing media

Movies can be flat or placed in their own folders. Including the release year gives TMDB a better chance of finding the right title.

```text
/media/movies/
  Perfect Days.2023.mkv
  Dune Part Two (2024)/Dune.Part.Two.2024.mp4
```

For series, a top-level folder per show is the clearest layout:

```text
/media/series/The Bear/
  Season 03/The.Bear.S03E01.Tomorrow.mkv
  Season 03/The.Bear.S03E02.Next.mkv
```

Flat series folders work too, as long as the show name and episode marker are present in each filename:

```text
/media/series/
  The.Bear.S03E01.Tomorrow.mkv
  The.Bear.S03E02.Next.mkv
```

Ploux recognizes `S01E02`, `1x02`, and common anime names ending in ` - 02`.

External subtitles belong beside the video and must start with the same filename stem:

```text
The.Bear.S03E01.Tomorrow.mkv
The.Bear.S03E01.Tomorrow.en.srt
The.Bear.S03E01.Tomorrow.fr.default.ass
```

SRT, VTT, ASS, and SSA files are supported. Browser playback receives WebVTT; the Android TV client keeps ASS/SSA styling through libass. Embedded subtitle tracks are played by compatible clients but are not extracted into separate files.

## Direct play and format support

Ploux does not transcode video or audio. That keeps the server simple, but the device doing the playback must understand the file.

- Browsers are most reliable with MP4 containing H.264 and AAC. HEVC support depends on the browser and operating system, and MKV support varies considerably.
- The Android TV player uses AndroidX Media3 (ExoPlayer), hardware video decoding, a local FFmpeg audio decoder fallback for formats such as AC3, E-AC3, and DTS, and libass for styled subtitles.
- AVI files requested by the TV app can be remuxed to MKV with FFmpeg. This is a cached stream copy, not a video or audio transcode.
- A file may scan successfully even when the current playback device cannot decode it.

## Android TV

The TV app lives in `apps/tv` and targets Android TV only. On first launch it asks for the Ploux server's LAN address, for example `http://192.168.1.10:3000`. Remember that `localhost` on the TV means the TV itself; an Android emulator can reach the host at `http://10.0.2.2:3000`.

To build and install it locally:

```bash
cd apps/tv
bun run prebuild
bun run android
```

This requires Android Studio, the Android SDK, and a connected device or emulator. After prebuild, a release APK can also be built with:

```bash
cd apps/tv/android
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

The repository also includes a GitHub Actions workflow for permanently signed release APKs and in-app updates. The one-time signing setup is documented in the [Android TV release guide](docs/android-tv-releases.md). Native playback licenses and source links are listed in [third-party notices](apps/tv/THIRD_PARTY_NOTICES.md).

## Running a production build

```bash
bun run build
bun run start
```

The build produces browser assets in `dist/client`, the TanStack Start handler in `dist/server`, and a bundled Bun entry at `dist/server.js`. A minimal deployment needs `dist`, `drizzle`, and Bun. FFmpeg/ffprobe remain optional.

For example, with PM2:

```bash
pm2 start dist/server.js --name ploux --interpreter bun
```

## Development

The main pieces are a TanStack Start/React web app, a Bun server, SQLite with Drizzle, shared Zod contracts, and a React Native TV client.

Useful commands:

```bash
bun run test          # Vitest suite
bun run typecheck     # web and server TypeScript
bun run typecheck:tv  # Android TV TypeScript
bun run lint          # Oxlint
bun run db:studio     # inspect the SQLite database
bun run verify        # all checks plus a production build
```

If you change `src/server/db/schema.ts`, generate and apply a migration with:

```bash
bun run db:generate
bun run db:migrate
```

The versioned JSON API is under `/api/v1`. Its schemas and the client shared by the web and TV apps live in `packages/contracts` and `packages/query`.

## Security

Ploux has no authentication and assumes it is running on a trusted home network. Do not expose it directly to the public internet. Use an authenticated reverse proxy or a VPN if you need remote access.

`PLOUX_CORS_ORIGIN` accepts one exact browser origin. Wildcard origins are deliberately ignored.

Ploux uses the TMDB API but is not endorsed or certified by TMDB.

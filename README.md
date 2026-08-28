# Ploux

Ploux is a small, direct-play home media server. It scans folders, enriches titles with TMDB, streams the original file with HTTP byte
ranges, remembers playback position, serves external subtitles, can permanently delete explicitly confirmed media, and exposes the same
API to its web and Android TV clients.

It deliberately has no transcoder, accounts, sharing, plugins, live TV, or cloud features.

## Stack

- Bun runtime and workspaces
- TanStack Start in client-only SPA mode, with Vite and React 19 Compiler
- TanStack Router, Query, Form, Store, and Table
- React Native TV/Expo client for Android TV
- SQLite through Drizzle ORM and generated migrations
- Tailwind CSS 4 and shadcn/ui Nova on Base UI
- Zod contracts shared by web, server, and TV
- Oxlint, Knip, Vitest, and TypeScript

## Quick start

Requirements: Bun 1.4+, optionally FFmpeg/ffprobe for detailed stream information, and optionally a
[TMDB v4 read access token](https://www.themoviedb.org/settings/api).

```bash
cp .env.example .env
bun install
bun run db:migrate
bun run dev
```

Open `http://localhost:3000/settings`, add an absolute server-side folder, and click **Scan**. The database is also migrated automatically on
first access; the explicit command makes setup failures easier to see.

For production:

```bash
bun run build
bun run start
```

Or with Docker:

```bash
MEDIA_PATH=/path/to/your/media docker compose up --build
```

The compose setup mounts `MEDIA_PATH` read/write at `/media` so explicitly confirmed permanent deletion works. Use paths below `/media`
when adding libraries through the dashboard. The Docker image includes ffprobe for detailed media information.

## Folder and filename conventions

Movie folders may be flat or nested:

```text
/media/movies/
  Dune Part Two (2024)/Dune.Part.Two.2024.mp4
  Perfect Days.2023.mkv
```

Series and anime work best with one top-level folder per title. Episode patterns `S01E02`, `1x02`, and common anime ` - 02` naming are
recognized.

```text
/media/series/The Bear/
  Season 03/The.Bear.S03E01.Tomorrow.mkv
  Season 03/The.Bear.S03E02.Next.mkv
```

External subtitles belong next to the video and begin with the same filename stem:

```text
The.Bear.S03E01.Tomorrow.mkv
The.Bear.S03E01.Tomorrow.en.srt
The.Bear.S03E01.Tomorrow.fr.default.ass
```

Supported external formats are `.srt`, `.vtt`, `.ass`, and `.ssa`. Ploux converts them to WebVTT when served. It does not extract subtitle
tracks embedded in a container.

## Direct-play limits

Ploux never transcodes or rewrites media. It serves `Range` requests from the original file, which makes seeking efficient but means the
playback device must support the container and every codec inside it. The explicit permanent-delete action is the sole operation that
removes source media and indexed external subtitle files.

- Browsers are usually safest with MP4 containing H.264/H.265 where supported and AAC audio, or WebM.
- MKV support varies substantially in browsers.
- The Android TV app uses the platform player through `react-native-video`/ExoPlayer and usually supports more containers and codecs.
- A file can be indexed even when the current client cannot decode it. The web player shows a direct-play warning for containers with weak
  browser support.

## Android TV app

The TV project is in `apps/tv`. It is configured as an Android-TV-only, landscape Expo native project using `react-native-tvos`; it is not
intended for a store.

The TV client uses the same collection-first home, currently-watching data, server-side search, per-collection watch filters, sorting,
pagination, watch controls, collection management, metadata actions, media information, and progress APIs as the web UI. Its layouts and
dialogs are adapted for D-pad focus instead of pointer interaction.

1. Install Android Studio/SDK and enable developer mode plus USB/network debugging on the TV.
2. Connect the device with `adb connect TV_IP:5555` if using network ADB.
3. Build and install:

```bash
cd apps/tv
bun run prebuild
bun run android
```

On first launch, enter the Ploux server's LAN address, for example `http://192.168.1.10:3000`. `localhost` on the TV is the TV itself. The
Android emulator reaches the host through `http://10.0.2.2:3000`.

To produce a sideloadable release APK after prebuild:

```bash
cd apps/tv/android
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

For a long-lived personal install, configure a private release signing key in the generated Android project before building the release APK.

### Build an APK without an Android toolchain

The `Build Android TV APK` GitHub Actions workflow builds a standalone sideloadable APK entirely on GitHub's runner. Open the repository's
Actions tab, select the workflow, choose **Run workflow**, and download the `ploux-tv-apk` artifact when it finishes. Extract
`ploux-tv.apk` from the downloaded ZIP, then transfer it to the TV with a USB drive or a file-transfer app and install it after allowing that
app to install unknown applications. This personal build uses the generated debug signing key and is intended for direct sideloading, not
store distribution.

## API

The TV client consumes the versioned HTTP API under `/api/v1`:

| Method            | Endpoint                          | Purpose                                        |
|-------------------|-----------------------------------|------------------------------------------------|
| `GET`             | `/api/v1/`                        | Health and capabilities                        |
| `GET`             | `/api/v1/library`                 | Search, watch-status filter, and sort media    |
| `GET/PUT/DELETE`  | `/api/v1/media/:id`               | Details/info, watch state, permanent deletion  |
| `GET/HEAD`        | `/api/v1/stream/:partId`          | Original file with byte-range support          |
| `GET`             | `/api/v1/subtitles/:id`           | WebVTT subtitle response                       |
| `GET/POST/DELETE` | `/api/v1/progress`                | List, save, or clear resume progress           |
| `GET/POST/PUT/DELETE` | `/api/v1/settings/libraries`         | Manage indexed folders                         |
| `POST`                | `/api/v1/settings/scan`              | Walk one or all libraries                      |
| `GET`                  | `/api/v1/settings/overview`          | Read settings overview                         |
| `POST`                | `/api/v1/settings/metadata/search`   | Search TMDB candidates                         |
| `POST`                | `/api/v1/settings/metadata/identify` | Apply a manual TMDB match                      |
| `POST`                | `/api/v1/settings/metadata/refresh`  | Refresh the current match                      |

Shared input validation and response types live in `packages/contracts`.

## Maintenance

```bash
bun run db:generate   # after changing src/server/db/schema.ts
bun run db:migrate
bun run db:studio
bun run verify        # web + TV types, Oxlint, Knip, tests, production build
```

## Security and metadata

Ploux assumes a trusted home network and has no authentication. Do not publish port 3000 directly to the internet. Put it behind an
authenticated reverse proxy or VPN if remote access is required.

TMDB credentials are supplied through `TMDB_READ_ACCESS_TOKEN`. This product uses the TMDB API but is not endorsed or certified by TMDB.

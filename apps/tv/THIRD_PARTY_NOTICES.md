# Android TV third-party notices

Ploux TV embeds the following native components in its APK. The Ploux TV
client itself is distributed under the GNU GPL version 3; see `LICENSE` in
this directory. The Ploux server and web application are separate programs.

## react-native-blob-util

- Version: 0.24.10
- Project: https://github.com/RonRadtke/react-native-blob-util
- License: MIT
- License text: https://github.com/RonRadtke/react-native-blob-util/blob/v0.24.10/LICENSE

Ploux uses its native file hashing API to verify large update APKs without loading them into the JavaScript or Java heap.

## AndroidX Media3

- Version: 1.9.0
- Project: https://github.com/androidx/media
- License: Apache License 2.0
- License text: https://github.com/androidx/media/blob/release/LICENSE

Media3 provides the native Android playback engine, media session, container
extractors, hardware-video integration, and player views.

## Jellyfin AndroidX Media3 FFmpeg decoder

- Version: 1.9.0+1 (`org.jellyfin.media3:media3-ffmpeg-decoder`)
- Project and corresponding source: https://github.com/jellyfin/jellyfin-androidx-media
- Release: https://github.com/jellyfin/jellyfin-androidx-media/releases/tag/v1.9.0%2B1
- License: GNU General Public License, version 3
- License text: https://github.com/jellyfin/jellyfin-androidx-media/blob/master/LICENSE

The decoder is used as a local software-audio fallback for formats such as
AC3, E-AC3, and DTS. Ploux does not use it to transcode video on the server.

## libass-android / ass-media

- Version: 0.5.1 (`io.github.peerless2012:ass-media`)
- Project: https://github.com/peerless2012/libass-android
- License: MIT
- License text: https://github.com/peerless2012/libass-android/blob/master/LICENSE

The bundled libass library is ISC licensed:
https://github.com/libass/libass/blob/master/COPYING

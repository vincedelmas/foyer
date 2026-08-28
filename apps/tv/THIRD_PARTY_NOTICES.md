# Android TV third-party notices

Ploux TV embeds the following native components in its APK:

## react-native-blob-util

- Version: 0.24.10
- Project: https://github.com/RonRadtke/react-native-blob-util
- License: MIT
- License text: https://github.com/RonRadtke/react-native-blob-util/blob/v0.24.10/LICENSE

Ploux uses its native file hashing API to verify large update APKs without loading them into the JavaScript or Java heap.

## @lunarr/vlc-player

- Version: 2.1.0
- Project: https://github.com/lunarr-app/vlc-player
- License: MIT
- License text: https://github.com/lunarr-app/vlc-player/blob/v2.1.0/LICENSE

## LibVLC for Android

- Version: 3.7.5 (`org.videolan.android:libvlc-all`)
- Project: https://code.videolan.org/videolan/vlc-android
- License: GNU Lesser General Public License, version 2.1
- License text: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html
- Corresponding source: https://code.videolan.org/videolan/vlc-android/-/tree/libvlc-3.7.5

LibVLC runs locally on the playback device. Ploux does not modify LibVLC and does not use it to transcode media on the server.

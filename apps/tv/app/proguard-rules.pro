# Media3 loads the optional FFmpeg renderer through reflection.
-keep class androidx.media3.decoder.ffmpeg.** { *; }

# Preserve libass JNI entry points and renderer integration in release APKs.
-keep class io.github.peerless2012.ass.** { *; }

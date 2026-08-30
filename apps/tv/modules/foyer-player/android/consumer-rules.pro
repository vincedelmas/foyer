# Media3 discovers optional decoder extensions by class name.
-keep class androidx.media3.decoder.ffmpeg.** { *; }

# libass creates its renderer/parser integration through Kotlin extension APIs
# and JNI. Keep both the Java entry points and native method names intact.
-keep class io.github.peerless2012.ass.** { *; }

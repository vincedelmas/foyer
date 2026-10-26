import com.android.build.api.artifact.SingleArtifact
import java.security.MessageDigest
import java.time.Instant

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val releaseVersion = providers.environmentVariable("FOYER_TV_VERSION")
    .orElse(providers.gradleProperty("foyerVersion")).get()
require(releaseVersion.matches(Regex("\\d+\\.\\d+\\.\\d+"))) { "TV version must look like 1.4.1" }
val (major, minor, patch) = releaseVersion.split('.').map(String::toInt)
require(major in 0..2100 && minor in 0..999 && patch in 0..999)
val releaseVersionCode = major * 1_000_000 + minor * 1_000 + patch
require(releaseVersionCode in 1..2_100_000_000)
val updateRepository = providers.environmentVariable("GITHUB_REPOSITORY").getOrElse("vincedelmas/foyer")
require(updateRepository.matches(Regex("[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")))
val releaseTag = providers.environmentVariable("FOYER_TV_RELEASE_TAG").orElse("v$releaseVersion")
val releaseKeystore = System.getenv("FOYER_TV_KEYSTORE_PATH")

android {
    namespace = "com.foyer.tv"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.foyer.tv"
        minSdk = 30
        targetSdk = 36
        versionCode = releaseVersionCode
        versionName = releaseVersion
        ndk { abiFilters += "armeabi-v7a" }
        buildConfigField("String", "UPDATE_REPOSITORY", "\"$updateRepository\"")
    }

    signingConfigs {
        if (releaseKeystore != null) {
            create("permanentRelease") {
                storeFile = file(releaseKeystore)
                storeType = System.getenv("FOYER_TV_KEYSTORE_TYPE") ?: "PKCS12"
                storePassword = System.getenv("FOYER_TV_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("FOYER_TV_KEY_ALIAS")
                keyPassword = System.getenv("FOYER_TV_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        debug {
            // Keep development installs separate from the permanently signed app.
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-dev"
        }
        release {
            if (releaseKeystore != null) signingConfig = signingConfigs.getByName("permanentRelease")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isIncludeAndroidResources = true }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.08.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.tv:tv-material:1.0.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.3")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")

    // ass-media 0.5.1 uses unstable Media3 1.8.0 APIs: keep these versions aligned.
    val media3Version = "1.8.0"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-datasource:$media3Version")
    implementation("androidx.media3:media3-session:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")
    implementation("org.jellyfin.media3:media3-ffmpeg-decoder:1.8.0+1")
    implementation("io.github.peerless2012:ass-media:0.5.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation("androidx.test:core:1.7.0")
    testImplementation("androidx.compose.ui:ui-test-junit4")
}

// Keep Robolectric's Android framework JARs in the same cache restored by setup-gradle.
tasks.withType<Test>().configureEach {
    systemProperty("maven.repo.local", gradle.gradleUserHomeDir.resolve("caches/robolectric").path)
}

androidComponents {
    onVariants(selector().withBuildType("release")) { variant ->
        val apkDirectory = variant.artifacts.get(SingleArtifact.APK)
        val artifactsLoader = variant.artifacts.getBuiltArtifactsLoader()
        val releaseAssets = layout.buildDirectory.dir("outputs/release")

        tasks.register("prepareReleaseAssets") {
            group = "distribution"
            description = "Build the release APK and prepare its update manifest and SHA-256 checksum."
            inputs.dir(apkDirectory)
            inputs.property("version", releaseVersion)
            inputs.property("versionCode", releaseVersionCode)
            inputs.property("repository", updateRepository)
            inputs.property("tag", releaseTag)
            outputs.dir(releaseAssets)
            // Refresh the publication timestamp without invalidating cached compilation tasks.
            outputs.upToDateWhen { false }

            doLast {
                val tag = releaseTag.get()
                require(tag == "v$releaseVersion") { "Release tag must be v$releaseVersion" }
                // The Shield build emits exactly one ARM32 APK, signed when signing is configured.
                val artifact = artifactsLoader.load(apkDirectory.get())!!.elements.single()
                val directory = releaseAssets.get().asFile.apply { mkdirs() }
                val apk = file(artifact.outputFile).copyTo(directory.resolve("foyer-tv.apk"), overwrite = true)
                val digest = MessageDigest.getInstance("SHA-256")
                apk.inputStream().use { input ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count == -1) break
                        digest.update(buffer, 0, count)
                    }
                }
                val sha256 = digest.digest().joinToString("") { "%02x".format(it) }
                directory.resolve("foyer-tv.apk.sha256").writeText("$sha256  foyer-tv.apk\n")
                directory.resolve("update.json").writeText(
                    """
                    {
                      "schemaVersion": 1,
                      "version": "$releaseVersion",
                      "versionCode": $releaseVersionCode,
                      "apkUrl": "https://github.com/$updateRepository/releases/download/$tag/foyer-tv.apk",
                      "sha256": "$sha256",
                      "size": ${apk.length()},
                      "publishedAt": "${Instant.now()}"
                    }
                    """.trimIndent() + "\n"
                )
            }
        }
    }
}

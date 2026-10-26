import groovy.json.JsonSlurper

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val releaseVersion = System.getenv("FOYER_TV_VERSION")
    ?: (JsonSlurper().parse(rootProject.file("package.json")) as Map<*, *>)["version"] as String
val versionParts = releaseVersion.split('.').map(String::toInt)
require(versionParts.size == 3 && versionParts[1] in 0..999 && versionParts[2] in 0..999)
val releaseVersionCode = System.getenv("FOYER_TV_VERSION_CODE")?.toInt()
    ?: (versionParts[0] * 1_000_000 + versionParts[1] * 1_000 + versionParts[2])
require(releaseVersionCode in 1..2_100_000_000)
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
        val repository = System.getenv("GITHUB_REPOSITORY") ?: "vincedelmas/foyer"
        require(repository.matches(Regex("[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")))
        buildConfigField("String", "UPDATE_REPOSITORY", "\"$repository\"")
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
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

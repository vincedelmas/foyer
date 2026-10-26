# Android TV releases and in-app updates

Foyer TV updates are normal Android APK updates published as public GitHub Releases. The app checks the repo once a day, offers a manual
check under **Settings → App updates**, downloads the APK, verifies its size and SHA-256 digest, and opens Android's installer. SHA-256 is
calculated by streaming the file through native code, so verification does not load the whole APK into memory. Android still shows its own
installation confirmation.

## One-time signing setup

Every update must use the same signing key. Keep the resulting `.p12` file and its password in two safe places: losing either means future
versions cannot update existing installations.

The signing key can be created with OpenSSL:

```bash
mkdir foyer-tv-signing

openssl genpkey \
  -algorithm RSA \
  -aes-256-cbc \
  -pkeyopt rsa_keygen_bits:4096 \
  -out foyer-tv-signing/foyer-tv-private.pem

openssl req \
  -new \
  -x509 \
  -sha256 \
  -days 10950 \
  -key foyer-tv-signing/foyer-tv-private.pem \
  -out foyer-tv-signing/foyer-tv-certificate.pem \
  -subj "/CN=Foyer TV/"

openssl pkcs12 \
  -export \
  -name foyer-tv \
  -inkey foyer-tv-signing/foyer-tv-private.pem \
  -in foyer-tv-signing/foyer-tv-certificate.pem \
  -out foyer-tv-signing/foyer-tv-release.p12
```

Use a strong export password and save it in a password manager. In the public GitHub repository, open **Settings → Secrets and variables →
Actions** and create these repository secrets:

| Secret                       | Value                                          |
|------------------------------|------------------------------------------------|
| `FOYER_TV_KEYSTORE_BASE64`   | One-line base64 form of `foyer-tv-release.p12` |
| `FOYER_TV_KEYSTORE_PASSWORD` | The PKCS#12 export password                    |
| `FOYER_TV_KEY_ALIAS`         | `foyer-tv`                                     |
| `FOYER_TV_KEY_PASSWORD`      | The same PKCS#12 export password               |

On Linux, print the first value with:

```bash
base64 -w 0 foyer-tv-signing/foyer-tv-release.p12
```

The private key and keystore remain local; only the encrypted base64 keystore is stored as an Actions secret. GitHub does not expose
repository secrets in workflow logs or to builds from untrusted forks.

## Publish a version

Release Please manages versions from Conventional Commit messages pushed to `main`:

- `feat: add something` proposes a minor release.
- `fix: correct something` proposes a patch release.
- `feat!:` or a `BREAKING CHANGE:` footer proposes a major release.
- `refactor:` entries appear under **Refactors** in the changelog. A refactor alone does not select a new SemVer version, so it waits for the
  next feature/fix release unless a `Release-As: x.y.z` footer explicitly requests one.

Every push updates a Release Please PR containing the next version, `CHANGELOG.md`, and the web/TV version files. Nothing is published until
that PR is merged. Merging it creates a draft `vX.Y.Z` release and immediately invokes the signed Android workflow. The release becomes
public only after `foyer-tv.apk`, `foyer-tv.apk.sha256`, and `update.json` have been attached successfully.

Before the first run, enable **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**. Add the four
signing secrets before merging the first Release Please PR.

Android's `versionCode` is derived from SemVer (`0.2.1` becomes `2001`) rather than a workflow counter. The standalone Gradle project
is built directly, without Node dependencies or Expo prebuild. The Gradle cache is retained between workflow runs. Release APKs include only 32-bit ARM (`armeabi-v7a`) for the NVIDIA Shield TV 2019 Tube running Android 11.
The workflow runs Kotlin unit tests and Android release lint before publishing.
The Android workflow remains manually runnable as a recovery mechanism, but its version/tag must already exist as a Release Please release.
The APK is attached directly to that release rather than also being stored as a duplicate short-lived Actions artifact.

## First permanent installation

1. For the first installation, in `Downloader`, open the release APK URL, for example:

   ```text
   https://github.com/vincedelmas/foyer/releases/download/v<version>/foyer-tv.apk
   ```

2. Install and open it, then enter the Foyer server's LAN URL. When upgrading a permanently signed RN release, the saved URL is imported automatically.

3. For future versions, choose **Install update** inside the Foyer TV app. The first time, the TV may ask you to allow Foyer TV to install
   unknown apps. Grant that per-app permission, return to Foyer, and retry. All later APKs signed with the same key install over the current
   app while preserving its local settings.

## Native Kotlin builds

The TV build needs JDK 17 and Android SDK platform 36 / build tools 35.0.0. It runs on Android 11 (API 30) and later, with the Shield Tube as the supported device. `compileSdk` and `targetSdk` remain independent of that minimum runtime version.

For a local signed release, export the existing `FOYER_TV_KEYSTORE_PATH`, `FOYER_TV_KEYSTORE_PASSWORD`, `FOYER_TV_KEY_ALIAS`, and `FOYER_TV_KEY_PASSWORD` values, then run `./gradlew assembleRelease` in `apps/tv`. No signing secrets are stored in the source tree. Without these variables Gradle produces an unsigned release for inspection; `installDebug` uses a separate `.debug` application ID.

Gradle reads the default version from `apps/tv/package.json` (which Release Please maintains). `FOYER_TV_VERSION` and `FOYER_TV_VERSION_CODE` override it in CI. The update manifest and stable `foyer-tv.apk` asset name are unchanged.

The first Kotlin release must retain `com.foyer.tv`, the permanent signing key, and a greater version code. On first launch it imports the existing AsyncStorage `RKStorage` database into native preferences. Server-side collections, metadata, and playback progress remain on the Foyer server. Follow the [native migration checklist](android-tv-native.md) on the Shield before publishing.

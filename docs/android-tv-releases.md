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

Android's `versionCode` is derived from SemVer (`0.2.1` becomes `2001`) rather than a workflow counter. The Gradle cache is retained between
workflow runs, and the build cache reuses unchanged native compilation where possible. Release APKs include 32-bit and 64-bit ARM so they
support both the 32-bit NVIDIA Shield TV 2019 Tube and 64-bit Shield models. The unused x86 Android emulator architectures remain excluded.
The Android workflow remains manually runnable as a recovery mechanism, but its version/tag must already exist as a Release Please release.
The APK is attached directly to that release rather than also being stored as a duplicate short-lived Actions artifact.

## First permanent installation

1. For the first installation, in `Downloader`, open the release APK URL, for example:

   ```text
   https://github.com/vincedelmas/foyer/releases/download/v<version>/foyer-tv.apk
   ```

2. Install and open it, then enter the Foyer server's LAN URL again.

3. For future versions, choose **Install update** inside the Foyer TV app. The first time, the TV may ask you to allow Foyer TV to install
   unknown apps. Grant that per-app permission, return to Foyer, and retry. All later APKs signed with the same key install over the current
   app while preserving its local settings.

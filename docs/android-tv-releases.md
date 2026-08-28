# Android TV releases and in-app updates

Ploux TV updates are normal Android APK updates published as public GitHub Releases. The app checks the repo once a day, offers a manual
check under **Settings → App updates**, downloads the APK, verifies its size and SHA-256 digest, and opens Android's installer. SHA-256 is
calculated by streaming the file through native code, so verification does not load the whole APK into memory. Android still shows its own
installation confirmation.

## One-time signing setup

Every update must use the same signing key. Keep the resulting `.p12` file and its password in two safe places: losing either means future
versions cannot update existing installations.

The signing key can be created with OpenSSL:

```bash
mkdir ploux-tv-signing

openssl genpkey \
  -algorithm RSA \
  -aes-256-cbc \
  -pkeyopt rsa_keygen_bits:4096 \
  -out ploux-tv-signing/ploux-tv-private.pem

openssl req \
  -new \
  -x509 \
  -sha256 \
  -days 10950 \
  -key ploux-tv-signing/ploux-tv-private.pem \
  -out ploux-tv-signing/ploux-tv-certificate.pem \
  -subj "/CN=Ploux TV/"

openssl pkcs12 \
  -export \
  -name ploux-tv \
  -inkey ploux-tv-signing/ploux-tv-private.pem \
  -in ploux-tv-signing/ploux-tv-certificate.pem \
  -out ploux-tv-signing/ploux-tv-release.p12
```

Use a strong export password and save it in a password manager. In the public GitHub repository, open **Settings → Secrets and variables →
Actions** and create these repository secrets:

| Secret                       | Value                                          |
|------------------------------|------------------------------------------------|
| `PLOUX_TV_KEYSTORE_BASE64`   | One-line base64 form of `ploux-tv-release.p12` |
| `PLOUX_TV_KEYSTORE_PASSWORD` | The PKCS#12 export password                    |
| `PLOUX_TV_KEY_ALIAS`         | `ploux-tv`                                     |
| `PLOUX_TV_KEY_PASSWORD`      | The same PKCS#12 export password               |

On Linux, print the first value with:

```bash
base64 -w 0 ploux-tv-signing/ploux-tv-release.p12
```

The private key and keystore remain local; only the encrypted base64 keystore is stored as an Actions secret. GitHub does not expose
repository secrets in workflow logs or to builds from untrusted forks.

## Publish a version

Release Please manages versions from Conventional Commit messages pushed to `master`:

- `feat: add something` proposes a minor release.
- `fix: correct something` proposes a patch release.
- `feat!:` or a `BREAKING CHANGE:` footer proposes a major release.
- `refactor:` entries appear under **Refactors** in the changelog. A refactor alone does not select a new SemVer version, so it waits for the
  next feature/fix release unless a `Release-As: x.y.z` footer explicitly requests one.

Every push updates a Release Please PR containing the next version, `CHANGELOG.md`, and the web/TV version files. Nothing is published until
that PR is merged. Merging it creates a draft `v0.2.1` release and immediately invokes the signed Android workflow. The release becomes
public only after `ploux-tv.apk`, `ploux-tv.apk.sha256`, and `update.json` have been attached successfully.

Version `0.2.1` also publishes a one-time `tv-v0.2.1` compatibility release. The updater bundled in `0.2.0` only recognizes that older tag
prefix; once `0.2.1` is installed, the updater accepts both formats and prefers canonical `v` releases.

Before the first run, enable **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**. Add the four
signing secrets before merging the first Release Please PR.

Android's `versionCode` is derived from SemVer (`0.2.1` becomes `2001`) rather than a workflow counter. The Gradle cache is retained between
workflow runs, so later builds should avoid downloading and transforming most dependencies again. The Android workflow remains manually
runnable as a recovery mechanism, but its version/tag must already exist as a Release Please release.

## First permanent installation

1. For the first installation, in `Downloader`, open the release APK URL, for example:

   ```text
   https://github.com/vincedelmas/ploux/releases/download/tv-v0.2.0/ploux-tv.apk
   ```

2. Install and open it, then enter the Ploux server's LAN URL again.

3. For future versions, choose **Install update** inside the Ploux TV app. The first time, the TV may ask you to allow Ploux TV to install
   unknown apps. Grant that per-app permission, return to Ploux, and retry. All later APKs signed with the same key install over the current
   app while preserving its local settings.

### Upgrading from 0.2.0 or 0.2.1

The updater shipped before `0.2.2` tries to hold the entire APK in memory while verifying it and can run out of memory on Android TV. Install
`0.2.2` once through Downloader using the canonical release URL:

```text
https://github.com/vincedelmas/ploux/releases/download/v0.2.2/ploux-tv.apk
```

That installation updates the existing signed app and preserves its settings. In-app updates from `0.2.2` onward use native streaming
SHA-256 verification.

# Android TV releases and in-app updates

Ploux TV updates are normal Android APK updates published as public GitHub Releases. The app checks the repository once a day, offers a
manual check under **Settings → App updates**, downloads the APK, verifies its size and SHA-256 digest, and opens Android's installer.
Android still shows its own installation confirmation.

## One-time signing setup

Every update must use the same signing key. Keep the resulting `.p12` file and its password in two safe places: losing either means future
versions cannot update existing installations.

The signing key can be created with OpenSSL; no Android SDK is needed:

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

Use a strong export password and save it in a password manager. In the public GitHub repository, open **Settings → Secrets and variables
→ Actions** and create these repository secrets:

| Secret | Value |
|---|---|
| `PLOUX_TV_KEYSTORE_BASE64` | One-line base64 form of `ploux-tv-release.p12` |
| `PLOUX_TV_KEYSTORE_PASSWORD` | The PKCS#12 export password |
| `PLOUX_TV_KEY_ALIAS` | `ploux-tv` |
| `PLOUX_TV_KEY_PASSWORD` | The same PKCS#12 export password |

On Linux, print the first value with:

```bash
base64 -w 0 ploux-tv-signing/ploux-tv-release.p12
```

The private key and keystore remain local; only the encrypted base64 keystore is stored as an Actions secret. GitHub does not expose
repository secrets in workflow logs or to builds from untrusted forks.

## Publish a version

1. Push the desired code to the public repository's default branch.
2. Open **Actions → Build Android TV APK → Run workflow**.
3. Enter a new semantic version, such as `0.2.0`, and run it.
4. The workflow builds with the permanent key and publishes `ploux-tv.apk`, `ploux-tv.apk.sha256`, and `update.json` under a release named
   `tv-v0.2.0`.

The workflow run number becomes Android's monotonically increasing `versionCode`. A version tag cannot be overwritten; use a new version
for every published build.

The Gradle cache is retained between workflow runs, so later builds should avoid downloading and transforming most dependencies again.

## First permanent installation

The old APK was signed with a disposable debug key. Android therefore cannot install the first permanent build over it.

1. Uninstall the existing Ploux TV app once.
2. In Downloader, open the release APK URL, for example:

   ```text
   https://github.com/vincedelmas/ploux/releases/download/tv-v0.2.0/ploux-tv.apk
   ```

3. Install and open it, then enter the Ploux server's LAN URL again.

This one-time uninstall removes TV-local preferences, including the saved server URL and collection filters. Watch progress and the media
database live on the Ploux server and are unaffected.

For future versions, choose **Install update** in Ploux TV. The first time, the Shield may ask you to allow Ploux TV to install unknown
apps. Grant that per-app permission, return to Ploux, and retry. All later APKs signed with the same key install over the current app while
preserving its local settings.

## Server relationship

The APK updater is independent from the Ploux server deployment. Moving the server to the Ubuntu mini PC only requires updating the
saved server URL on the TV. Give the mini PC a DHCP reservation, allow TCP port 3000 from the LAN in UFW, run the production build as a
service, and install FFmpeg for media inspection and Android TV AVI remuxing. Do not expose port 3000 directly to the public internet.

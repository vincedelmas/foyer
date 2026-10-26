# TV releases

## Publish an update

1. Push your changes to `main`. Use `feat:` for a new feature or `fix:` for a fix.
2. Open the PR made by Release Please.
3. Add the **`tv-only` label** to this PR if you only want the APK.
4. Merge the PR. Wait for the APK build to finish.

The release tag stays `vX.Y.Z`. **`tv-only` is a PR label, not a Git tag.**
No label means both TV and server builds. `server-only` means only the server. Do not use both labels.
The APK workflow adds the APK, its checksum, and `update.json`. Then it makes the release public.
A commit with only `refactor:` does not start a new release by itself.

## Update from the TV

Open **Settings → App updates → Check for updates**.
The new version must use the same signing key and a higher version number. No uninstall is needed. Your saved settings stay in place.
The TV may ask you to allow Foyer to install apps. Allow it, then try again.

## Set up signing once

**If you already have a release key, keep using it.** Save a backup of the key and password.
For the first release, create a key with JDK 17. This command asks for a password.

```bash
mkdir -p ../foyer-tv-signing
keytool -genkeypair -alias foyer-tv -keyalg RSA -keysize 4096 \
  -validity 10950 -storetype PKCS12 -dname "CN=Foyer TV" \
  -keystore ../foyer-tv-signing/foyer-tv-release.p12
```

In GitHub, go to **Settings → Secrets and variables → Actions**. Add these secrets:

| Name                         | Value                  |
|------------------------------|------------------------|
| `FOYER_TV_KEYSTORE_BASE64`   | The key file as base64 |
| `FOYER_TV_KEYSTORE_PASSWORD` | The key file password  |
| `FOYER_TV_KEY_ALIAS`         | `foyer-tv`             |
| `FOYER_TV_KEY_PASSWORD`      | The same password      |

On Linux, get the base64 value with:

```bash
base64 -w 0 ../foyer-tv-signing/foyer-tv-release.p12
```

Also allow Actions to create pull requests under **Settings → Actions → General**.

## Build a release locally

Use the password and alias variables listed above. Also set `FOYER_TV_KEYSTORE_PATH` to your `.p12` file.

```bash
cd apps/tv
./gradlew prepareReleaseAssets
```

The three files are in `app/build/outputs/release/`.
Without signing settings, the APK is unsigned. You cannot install it.

The version is `foyerVersion` in `apps/tv/gradle.properties`. Release Please updates it.

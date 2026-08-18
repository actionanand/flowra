# Flowra Android build guide

Flowra uses Capacitor and GitHub Actions to package the Angular application as Android APK and AAB artifacts. The generated `android/` directory is intentionally not committed.

## Build files

| File                                  | Purpose                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `capacitor.config.ts`                 | App identity, Angular output, notification icon, and splash defaults                 |
| `.github/workflows/android-build.yml` | Lint, tests, Android builds, signing, releases, and uploaded artifacts               |
| `android-version.json`                | Android `versionCode` and `versionName`                                              |
| `scripts/bump-android-version.js`     | Safe version increments                                                              |
| `scripts/patch-android.mjs`           | Idempotent privacy, R8, splash, notification-channel, screenshot, and backup patches |
| `public/flowra.png`                   | Canonical brand, launcher, splash, and Play Store source                             |

## Dependencies

The repository declares the required packages but does not install them automatically. From WSL2 run:

```bash
npm i @capacitor/core @capacitor/android @capacitor/filesystem @capacitor/local-notifications @capacitor/splash-screen @capacitor-community/sqlite chart.js date-fns ionicons simple-statistics
npm i -D @capacitor/cli
```

This also updates `package-lock.json`, which must be committed so GitHub Actions can use `npm ci`.

## Local workflow

From WSL2:

```bash
npm run android:add
npm run android:sync
```

`android:sync` rebuilds Angular, synchronizes Capacitor, and reapplies the native patch. Then open from an environment with Android Studio:

```bash
npm run android:open
```

The generated shell uses minimum SDK 24, target SDK 36, Java 21, R8 optimization, and resource shrinking in CI.

## Versioning

```bash
npm run android:version         # increment versionCode only
npm run android:version:patch   # increment code and patch name
npm run android:version:minor
npm run android:version:major
```

Google Play requires a higher `versionCode` for every uploaded release. Pushes to `main-android` automatically increment it and commit the version plus generated release artifacts. Version tags matching `v*` create a GitHub Release.

## CI artifacts

Every workflow run creates a release APK, AAB, R8 `mapping.txt`, and 512×512 Play Store icon inside `releases/`, then uploads them for 30 days.

- Without signing secrets the artifact names end in `-unsigned`.
- With a complete keystore configuration CI replaces them with signed `flowra-<version>.apk` and `flowra-<version>.aab` files.
- A missing APK, AAB, or mapping file fails the workflow.

## Signing secrets

Add these under **Repository Settings → Secrets and variables → Actions**:

| Secret              | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `KEYSTORE_BASE64`   | Base64 text containing the complete keystore |
| `KEYSTORE_PASSWORD` | Keystore password                            |
| `KEY_ALIAS`         | Release signing alias                        |
| `KEY_PASSWORD`      | Private-key password                         |

Example on a trusted WSL/Linux machine:

```bash
keytool -genkeypair -v -keystore release-keystore.jks -storetype PKCS12 -alias flowra -keyalg RSA -keysize 4096 -validity 10000
base64 -w 0 release-keystore.jks > keystore.b64.txt
```

Never commit either file or a password. Keep an offline keystore backup; losing the Play signing key can prevent future updates.

## Reminders and privacy

Cycle reminders use Capacitor Local Notifications and an Android channel created by the native patch. Flowra cancels the stable per-profile notification before rescheduling, preventing duplicates when a prediction changes or an actual period begins. The default is three days before the most likely date; private mode shows only “Upcoming health reminder.” Web builds store choices but do not send browser notifications.

The patch disables Android cloud/device-transfer backup for app databases and preferences, exposes screenshot blocking through `FLAG_SECURE`, marks notification content private on the lock screen, and uses a monochrome `ic_stat_flowra` system icon. Browser health records use encrypted IndexedDB; Android records use the app-private SQLite database. User-created `.flowra` backups are password protected with PBKDF2-SHA-256 and AES-GCM.

## Biometric application unlock

Biometric unlock is Android-only and requires an application PIN first. Enable it from **Settings → App security → Biometric unlock**, enter the current Flowra PIN, and complete Android's biometric prompt.

The generated native shell uses AndroidX Biometric with `BIOMETRIC_STRONG`. The PIN is stored only as AES-GCM ciphertext in private Android preferences. Its encryption key is non-exportable, requires biometric authentication for every use, and lives in Android Keystore. Adding or removing a biometric invalidates the key; use the normal Flowra PIN and enable biometric unlock again afterward. Disabling the app PIN also deletes the wrapped PIN and its Keystore key.

Run `npm run android:sync` after changing the native bridge. No separate biometric JavaScript package is required.

`public/flowra.png` is used for the in-app brand, launcher, splash, and store icon. Run `npm run android:sync` after changing it.

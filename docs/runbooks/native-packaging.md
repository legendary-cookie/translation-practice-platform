# Native packaging

The Windows and Android packages wrap the existing Vite production bundle. They do not add accounts, analytics, synchronization, or automatic cloud evaluation.

## Build the Windows packages

Requirements: Node.js 22 or newer on Windows. Electron and electron-builder create an x64 NSIS installer and a portable executable. The canonical command explicitly runs the pinned Electron package's binary installer, then copies that distribution into the application. Electron 44's npm package has no postinstall script; assuming `npm ci` created `electron/dist` caused a reproduced CI failure. Reusing the installed distribution also avoids the archive-directory rename that failed with local Windows permissions.

```powershell
npm ci
npm run package:windows
```

Outputs:

The command sets `--publish never` explicitly. Electron-builder 26 otherwise attempts implicit publishing on a main-branch CI run and requires a token even after creating the packages. GitHub releases are published explicitly after verification.

- `artifacts/windows/Lingo-Practice-Setup-0.1.1.exe`
- `artifacts/windows/Lingo-Practice-Portable-0.1.1.exe`

The executables are unsigned. Windows may show a SmartScreen warning. No update service or signing key is configured. The packaged app records its first loopback port in `desktop-origin.json` under Electron user data and reuses that origin across launches. If occupied, startup fails visibly instead of opening an empty workspace at another origin. One earlier IndexedDB origin is adopted automatically; several earlier origins require a selection while preserving all folders. A build hash on the launch URL prevents stale cached HTML after upgrades. The wrapper applies a restrictive Content Security Policy, denies navigation away from the app, and asks before granting microphone access.

## Build the Android APK

Requirements: Node.js 22 or newer, JDK 21 or newer, Android SDK command-line tools, and Android platform 36. Gradle installs its configured Build Tools package when needed. Accept the Android SDK licenses on the build machine before installing SDK packages. Capacitor 8 supplies the Android Gradle project.

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME = '<path to JDK 21 or newer>'
npm ci
npm run package:android
```

If a sandboxed Windows build shell fails before Gradle configuration with
`Unable to establish loopback connection`, this process-local JDK workaround
worked in the shell used to verify this package:

```powershell
$env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir=C:/__codex_missing_unix_socket_dir__'
npm run package:android
```

Use it only when that specific loopback startup error occurs.

The command creates `artifacts/android/Lingo-Practice-0.1.1-debug.apk`. It is signed with the machine's local Android debug key for sideload testing. It is not a Play Store release package. A production release needs a user-controlled signing key that must be backed up securely and kept out of GitHub.

The Android manifest requests microphone permission only for the interpreting recording flow and disables app data backup to preserve the local-only storage boundary. Browser audio recording still requires the Android permission prompt. Learner records remain in the app's local WebView storage. Hardware Back dismisses an open consent dialog, saves an active exam through its fenced save-and-exit path, confirms before discarding an interpreting take, or returns to Home. Back on Home minimizes the app.

JSON exports use Android's system document picker without storage permissions or a shared temporary archive. The archive stays in memory while choosing a destination, outside Android's size-limited saved-state bundle. If Android kills the process during export, retry the export; the saved workspace remains unchanged. Exports are reference-only, without import/restore.

Language and appearance preferences use native Android Preferences and hydrate the WebView mirror before React mounts. Writes/reset are serialized. Local data deletion replaces the native value with an empty object, preventing stale WebView preferences from being migrated back after restart. New audio records store inline bytes in IndexedDB schema 7 with strict durability, avoiding external Blob backing files. The exact source/response audio hashes and Chinese preference survived a full emulator reboot. Readable legacy Blob records are supported, but already-unreadable old files cannot be reconstructed by this change; export earlier experimental builds before updating when possible.

The Android asset-preparation step adds a hash of the bundled HTML to `server.appStartPath` in the generated native configuration. This keeps the same storage origin while bypassing stale service-worker HTML after APK updates. Use the canonical packaging command, which runs Capacitor sync before adding that build-specific path.

## Repeat native checks

`node scripts/desktop-checks.cjs` uses a disposable Electron profile and checks exact draft recovery after a full app relaunch. Set `DESKTOP_QA_EXECUTABLE` to the absolute unpacked `Lingo Practice.exe` path to check the packaged runtime. `node scripts/desktop-model-check.cjs` downloads the optional model into a separate QA profile and performs a real synthetic inference; this needs a compatible GPU, sufficient memory, and internet for initial preparation. Set `DESKTOP_QA_PROFILE` to reuse that QA cache.

Install the APK on an isolated Android emulator, launch it, and set `ANDROID_QA_SERIAL` to its `emulator-NNNN` serial before running `node scripts/android-checks.cjs`. This changes only the selected emulator's app, grants its synthetic microphone permission, and writes a synthetic export into Downloads. It must never target a learner device. The 2026-10-16 run used Android 16 / API 36 and WebView 133.0.6943.137; recording/replay used WebM/Opus and packaged WAV sources.

The GitHub `Verify and package` workflow runs unit, production browser, Chinese interface, packaged Windows persistence, and build checks on PRs and main pushes. It uploads unsigned Windows installers/portable EXEs and debug APKs with SHA256 hashes for 14 days. It does not publish a release or run model/physical-device qualification.

## Qualification limits

The Android emulator passed native Back, rotation, background/relaunch, draft recovery, recording/replay, and system-picker export checks. A physical Galaxy S25 Ultra additionally passed lifecycle, exact draft recovery, Chinese interface, local microphone save/replay and cleanup checks. Full IME composition, calls/headset interruptions, recording quality and comprehensive reader acceptance remain unqualified. The human TalkBack check reported formatting announcements; no raw CSS was present in the inspected native or WebView accessibility trees. See the dated report below. Android local-model evaluation remains gated as unsupported on mobile. Windows Electron model preparation and validated synthetic inference were observed on this desktop; they do not establish broad device support or calibrated scores. Cloud evaluation continues to require the app's existing per-task consent step; no live cloud-provider request was used for qualification.

## Isolated physical-device checks

Set `ANDROID_QA_BUILD=1` before `npm run package:android` to create the separate `com.legendarycookie.lingopractice.qa` app. This variant uses a distinct name, storage and permissions. It does not replace the ordinary app. Clear the environment variable before building the distributable debug APK.

The optional Android instrumentation runner targets only `.qa`, retains the real accessibility service, and inspects only the foreground QA package. Build it with `android/gradlew.bat -p android assembleQaAndroidTest`, then install `android/app/build/outputs/apk/androidTest/qa/app-qa-androidTest.apk`. Use `scripts/test-phone-screen-reader.ps1` with the explicit device serial and installed reader service component. It snapshots and restores the enabled services, accessibility and touch-exploration settings. An injected gesture failure is a failed check, not evidence of a successful human gesture. Do not run against the ordinary learner app.

Physical and model evidence for 0.1.1 is in [the dated verification report](2026-10-16-phone-accessibility-and-local-ai.md).

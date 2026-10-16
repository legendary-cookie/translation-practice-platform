# Native packaging

The Windows and Android packages wrap the existing Vite production bundle. They do not add accounts, analytics, synchronization, or automatic cloud evaluation.

## Build the Windows packages

Requirements: Node.js 22 or newer on Windows. Electron and electron-builder create an x64 NSIS installer and a portable executable.

```powershell
npm ci
npm run package:windows
```

Outputs:

- `artifacts/windows/Lingo-Practice-Setup-0.1.0.exe`
- `artifacts/windows/Lingo-Practice-Portable-0.1.0.exe`

The executables are unsigned. Windows may show a SmartScreen warning. No update service or signing key is configured. The packaged app serves its bundled files from a random loopback port, applies a restrictive Content Security Policy, denies navigation away from the app, and asks before granting microphone access.

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

The command creates `artifacts/android/Lingo-Practice-0.1.0-debug.apk`. It is signed with the machine's local Android debug key for sideload testing. It is not a Play Store release package. A production release needs a user-controlled signing key that must be backed up securely and kept out of GitHub.

The Android manifest requests microphone permission only for the interpreting recording flow and disables app data backup to preserve the local-only storage boundary. Browser audio recording still requires the Android permission prompt. Learner records remain in the app's local WebView storage; this wrapper adds no migration or sync path.

## Qualification limits

The browser suite validates the shared web experience, not native WebView behavior. The APK has not been qualified on a physical phone for keyboard, back navigation, rotation, interruptions, accessibility, or microphone codecs. Android local-model evaluation remains gated as unsupported on mobile. The packaged Windows shell is smoke-tested separately, but Electron local-model inference and real microphone behavior are not release claims. Cloud evaluation continues to require the app's existing per-task consent step.

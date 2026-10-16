# Release verification

Verified on 2026-10-16 on the takeover branch. These results qualify an installable QA build, with the device and signing limits below.

## Observed gates

| Gate | Command | Observed result |
| --- | --- | --- |
| Regression suite | `npm test` | Exit 0; 123 tests, none failed or skipped; also passed under Node 22.23.3 |
| TypeScript and production bundle | `npm run build` | Exit 0; 132 modules |
| Browser journeys plus localization | `node scripts/verify-browser.cjs` | Exit 0; 108 English assertions, six Chinese interface checks, and two delayed-storage recovery checks |
| Windows packaging | `npm run package:windows` | Exit 0; x64 installer and portable executable |
| Packaged Windows persistence | `DESKTOP_QA_EXECUTABLE=... node scripts/desktop-checks.cjs` | Exit 0; exact IndexedDB answer and localStorage marker survive full app relaunch at the same origin |
| Packaged Windows local inference | `DESKTOP_QA_EXECUTABLE=... DESKTOP_QA_PROFILE=... node scripts/desktop-model-check.cjs` | Earlier runs exit 0 with one repair, 3.8–4.8 s warm preparation and 20.2–20.8 s feedback; latest qualification attempt exit 1 after two invalid source-evidence responses, no score saved |
| Android packaging and signature | `npm run package:android`; `apksigner verify --print-certs` | Exit 0; Android Debug certificate |
| Android native journeys | `ANDROID_QA_SERIAL=emulator-5580 node scripts/android-checks.cjs` | Exit 0; seven checks in Android 16 / API 36 WebView 133.0.6943.137, plus full-emulator-reboot audio hash/preference and native deletion/restart checks |
| Runtime dependency audit | `npm audit --omit=dev --audit-level=moderate` | Exit 0; zero vulnerabilities |
| Whitespace | `git diff --check` | Exit 0 |

The Windows runtime was Electron 44.8.0 / Chromium 152.0.7977.167, with WebGPU available and a coarse device-memory signal of 32 GiB. An earlier inference harness included a 30-second diagnostic locator wait; that wait was removed before the later 20.8-second successful visible-feedback run. The repaired prompt retains strict literal quotation validation and includes the failure reason on retry. Several runs rejected malformed JSON and then passed on repair, with networking disabled after preparation. The latest qualification attempt rejected nonliteral source evidence twice after 24.6 seconds and correctly saved no score. Local execution is demonstrated; reliable feedback acceptance and critique quality remain unqualified. A model critique can also be wrong even when it passes structural validation.

The Android emulator used an isolated QA AVD. Hardware Back retained the exact draft; portrait/landscape rotation had no horizontal overflow; background/foreground and a killed/relaunched app restored the answer. A synthetic/silent emulator microphone take was saved as a scoreless review, survived a process kill, and replayed using WebM/Opus. Packaged source audio was WAV. The system document picker wrote a readable 2.3 MiB JSON archive containing exact written text and recordings. An initial crash reproduced Android's saved-state size limit; keeping the archive out of Capacitor's persisted activity-call options fixed it.

Additional restart checks reproduced lost WebView appearance preferences and two unreadable older synthetic Blob recordings. Native Preferences now preserve appearance/language across an immediate kill; new audio uses standalone bytes and strict IndexedDB commits. Both new source/response audio SHA256 hashes and Chinese preferences survived a full emulator reboot. The two old QA recordings were recovered from an earlier successful synthetic archive; that was a fixture repair, not a product import feature. Native deletion also cleared every practice/audio store and resisted a deliberately stale appearance snapshot on restart. Android now launches with a bundle-hash query, preventing an older service-worker HTML cache from running stale code after an APK update. Existing readable Blob records remain supported. The app cannot reconstruct bytes of an already-unreadable legacy recording, and no general restore flow is claimed.

A CI failure also reproduced starting practice before draft recovery finished. The setup control now stays disabled during that read; a deterministic browser check holds and releases database-open success to verify this path. Stale tabs still cannot overwrite a new owner after deletion.

An intermittent glossary test failure was traced to an assertion matching the still-filled textarea rather than a saved card, followed by reload before the queued write completed. Holding the data-write lock reproduced that exact mismatch. The suite now waits on `.learning-card` before reload/export, and a separate controlled-lock check verifies queued-save and reload behavior. Six repeated smoke runs exercise the corrected selector; no production storage change was made for that test error.

The Chinese interface checks cover persistence, unchanged authored/learner text, 320/390/768/1440 pixel layouts, core routes, JSON export, returning to English, and the exam's fenced save-and-exit Back path. The English matrix retains twelve language-direction input checks, both themes, offline shell boot, storage denial, draft ownership/deletion, mock-provider consent, learning cards, exam recovery, and synthetic audio. No real API key, learner records, or cloud provider was used.

Model runtime and worker chunks remain about 6 MB each and trigger Vite's chunk-size warning. They are excluded from initial shell precaching and cached on demand after preparation. The main entry is about 720 kB before compression. Production dependencies audit clean; the full development dependency tree still reports eight moderate findings through packaging tooling.

## Packages from this local build

| Package | Bytes | SHA256 |
| --- | ---: | --- |
| `Lingo-Practice-Setup-0.1.0.exe` | 129525970 | `BDFDD08C38CBEA662E36E499E1D7812A569C01CD7D8899D8FEC888EB2379B10E` |
| `Lingo-Practice-Portable-0.1.0.exe` | 129305719 | `103369BC458BEF58C33BD2DB77D091E76FAE2C3CB3A387082FB686CB1F67103E` |
| `Lingo-Practice-0.1.0-debug.apk` | 12721733 | `AF714C82E08CACCBBC046A56255FD9A57BE3259902C338F5EC795B8D66793AB6` |

Outputs are in ignored `artifacts/windows/` and `artifacts/android/`. Rebuilds can differ; use their own generated hashes. The GitHub workflow rebuilds packages and uploads hashes and QA binaries, without publishing a release.

## Remaining acceptance boundaries

- Windows executables are unsigned; the APK is debug-signed for sideloading. Publisher signing and store distribution need the owner's signing identity and securely backed-up keys.
- Physical Android keyboard/IME, interruptions, real microphone quality, and screen-reader use have not been qualified. Emulator and responsive-browser results do not establish those outcomes.
- Android local inference remains restricted. The one Windows task does not establish critique quality, all-language quality, low-memory device safety, or a latency guarantee.
- Real cloud-provider behavior remains unqualified; mock-provider consent/privacy paths pass. No API credential was supplied.
- UI language choices are English and Simplified Chinese. Authored exam profiles, passages, and generated feedback retain their original language. Other interface translations, generated drills, and alternative model tiers are outside this QA release.
- JSON exports are reference-only; there is no import/restore flow. Installed PWA acceptance is not claimed from disposable browser contexts.

## Recovery and rollback

No learner database or original worktree was used for QA. Desktop storage now saves a stable port in `desktop-origin.json` under Electron user data. Preserve that file and the whole user-data directory if repairing an occupied port or selecting an older workspace. Do not delete IndexedDB folders to resolve startup errors. Earlier origins remain available on disk. Export through the old build before changing versions when possible.

Schema 7 preserves existing stores and uses a new audio byte representation. An IndexedDB version downgrade to schema 4 or 6 is not a rollback path. To roll back the UI/native changes, rebuild earlier UI code with schema-7/audio-reader compatibility in a separate checkout and preserve the learner profile; keep the stable-origin correction so an old random-port build does not appear to lose data. No production deployment, account, sync service, or system-wide environment setting was changed.

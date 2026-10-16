# Release verification

Verified on 2026-10-16 on the takeover branch. These results qualify an installable QA build, with the device and signing limits below.

## Observed gates

| Gate | Command | Observed result |
| --- | --- | --- |
| Regression suite | `npm test` | Exit 0; 116 tests, none failed or skipped |
| TypeScript and production bundle | `npm run build` | Exit 0; 127 modules |
| Browser journeys plus localization | `node scripts/verify-browser.cjs` | Exit 0; 108 English assertions and six Chinese interface checks |
| Windows packaging | `npm run package:windows` | Exit 0; x64 installer and portable executable |
| Packaged Windows persistence | `DESKTOP_QA_EXECUTABLE=... node scripts/desktop-checks.cjs` | Exit 0; exact IndexedDB answer and localStorage marker survive full app relaunch at the same origin |
| Packaged Windows local inference | `DESKTOP_QA_EXECUTABLE=... DESKTOP_QA_PROFILE=... node scripts/desktop-model-check.cjs` | Exit 0; warm preparation 4.1 seconds; validated feedback after one repair, engine generation/validation 20.7 seconds; networking disabled after preparation |
| Android packaging and signature | `npm run package:android`; `apksigner verify --print-certs` | Exit 0; Android Debug certificate |
| Android native journeys | `ANDROID_QA_SERIAL=emulator-5580 node scripts/android-checks.cjs` | Exit 0; six checks in Android 16 / API 36 WebView 133.0.6943.137 |
| Runtime dependency audit | `npm audit --omit=dev --audit-level=moderate` | Exit 0; zero vulnerabilities |
| Whitespace | `git diff --check` | Exit 0 |

The Windows runtime was Electron 44.8.0 / Chromium 152.0.7977.167, with WebGPU available and a coarse device-memory signal of 32 GiB. The inference harness's visible-feedback timer included a 30-second diagnostic locator wait, subsequently removed; the metadata event gives the 20.7-second generation/validation measurement. Initial local-model runs rejected paraphrased source evidence. The repaired prompt retains strict literal quotation validation and includes the failure reason on retry. On the final run the first response was malformed JSON; the second passed validation. This establishes execution, not feedback accuracy or reliability. A model critique can still be wrong; the learner can mark it Incorrect.

The Android emulator used an isolated QA AVD. Hardware Back retained the exact draft; portrait/landscape rotation had no horizontal overflow; background/foreground and a killed/relaunched app restored the answer. A synthetic/silent emulator microphone take was saved as a scoreless review and replayed using WebM/Opus. Packaged source audio was WAV. The system document picker wrote a readable 1.2 MiB JSON archive containing exact written text and recordings. An initial crash reproduced Android's saved-state size limit; keeping the archive out of Capacitor's persisted activity-call options fixed it.

The Chinese interface checks cover persistence, unchanged authored/learner text, 320/390/768/1440 pixel layouts, core routes, JSON export, returning to English, and the exam's fenced save-and-exit Back path. The English matrix retains twelve language-direction input checks, both themes, offline shell boot, storage denial, draft ownership/deletion, mock-provider consent, learning cards, exam recovery, and synthetic audio. No real API key, learner records, or cloud provider was used.

Model runtime and worker chunks remain about 6 MB each and trigger Vite's chunk-size warning. They are excluded from initial shell precaching and cached on demand after preparation. The main entry is about 718 kB before compression. Production dependencies audit clean; the full development dependency tree still reports eight moderate findings through packaging tooling.

## Packages from this local build

| Package | Bytes | SHA256 |
| --- | ---: | --- |
| `Lingo-Practice-Setup-0.1.0.exe` | 129424143 | `08D47B5A0211433CA920A37841A97176F8FA57394EE5312EFB0F9F2489F25D07` |
| `Lingo-Practice-Portable-0.1.0.exe` | 129203950 | `C3EE2E334C718DF652280AE17E45ED86C6C1F8E4D9412E6F6CCD4677D56B66B2` |
| `Lingo-Practice-0.1.0-debug.apk` | 12720769 | `BC39C41504E7ACB99CB5BF8525BFD64A1705D010DA9D58A3F4D4BAF24EC11AF0` |

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

Schema 6 remains additive. An IndexedDB version downgrade to schema 4 is not a rollback path. To roll back the UI/native changes, rebuild the earlier source in a separate checkout and preserve the learner profile; keep the stable-origin correction so an old random-port build does not appear to lose data. No production deployment, account, sync service, or system-wide environment setting was changed.

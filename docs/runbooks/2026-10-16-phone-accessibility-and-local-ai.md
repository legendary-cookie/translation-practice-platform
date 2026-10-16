# Lingo Practice 0.1.1 verification

Verified on 2026-10-16. This is an installable QA build. It has no publisher signing identity, store distribution, automatic updater or calibrated exam scoring.

## Acceptance and changes

- Exercise the real phone without replacing a learner installation or exporting the microphone sample.
- Use real accessibility services, record observed behavior, and keep automated checks distinct from human acceptance.
- Select a compact model using real inference, reject invalid evidence and preserve explicit cloud consent.
- Build Windows and Android packages, update GitHub and publish the repository at the owner's request.

The QA Android variant has a separate `com.legendarycookie.lingopractice.qa` application ID and storage. The distributable retains `com.legendarycookie.lingopractice`. Version 0.1.1 uses Android version code 2. Package hashes are in the download's `SHA256SUMS.txt`; CI rebuilds have their own hashes and debug signing key.

## Physical phone

Galaxy S25 Ultra (`SM-S938B`), Android 16 / API 36, WebView 154.0.8037.106, CSS viewport 411 × 891. Only the owner profile and separate QA application were inspected. No device serial, recording or learner profile is published.

Observed checks:

1. Hardware Back and exact draft recovery, including Unicode and whitespace.
2. Portrait/landscape layout and preservation of the same answer.
3. Background/foreground draft retention.
4. Process stop/restart with exact saved draft recovery.
5. Chinese interface and hardware Back cancellation of deletion confirmation.
6. One explicitly approved five-second microphone sample, saved and replayed locally.
7. Deletion verified across process restart: recordings, interpreting sessions, written sessions, workspace, ratings, cards, settings and exam runs/results were empty. Three bundled exam profiles reseed automatically.

The sample never left the phone. Its recording was deleted, microphone permission revoked, rotation settings restored, and original accessibility service/touch-exploration settings restored and verified.

### Reproduced renderer crash

Entering interpreting originally killed the QA app. Its scoped native log reported `No binder found for interface media.mojom.OnDeviceSpeechRecognition`, followed by renderer termination for a bad IPC message. WebView exposed `SpeechRecognition.available()` without a usable native implementation; JavaScript timeout/error handling could not prevent the process death.

Android WebView now bypasses that capability probe and installation path. The regression test fails before the guard and passes afterward, with zero native speech-method calls. Physical interpreting, recording and replay then succeeded. Manual transcript confirmation remains available; there is no remote speech fallback.

## Accessibility

Changes include focus movement after route/workspace transitions, accessible deletion/exam dialogs with safe initial focus and Escape restoration, keyboard passage tabs with labeled panels, focusable source scrolling, quieter timer semantics, one main landmark and theme-aware contrast fixes. A browser harness startup race was corrected by waiting for the rendered Home heading before its first Tab.

The automated matrix covers English and Simplified Chinese, light/dark themes, 390/1440-pixel viewports, all six routes, written/exam workspaces and delete/aids/submit dialogs. It includes keyboard focus containment/restoration and passage-tab navigation. Automated results do not establish audible pronunciation or universal WCAG conformance.

### Real NVDA

Portable NVDA 2026.2 was obtained with a valid NV Access signature, using an isolated configuration. The app-scoped speech queue captured the Practice heading and main landmark, labeled practice selector, Settings, deletion dialog, Keep local data, Confirm deletion and restored deletion trigger. The voice was muted for this observation; it is evidence of reader output, not an audible pronunciation assessment. A later automated replay did not reliably regain native focus; it remains a harness failure, not a complete reader pass. Chinese speech and comprehensive browse navigation remain unqualified. NVDA was stopped after the check.

### Real TalkBack

Samsung TalkBack 16.2.00.12 ran on the phone without suppressing accessibility services. Injected swipe focus movement was observed once but did not repeat consistently, so the instrumentation runner is not reported as passing. A human swipe check was performed; the user reported colors/pixel sizes being spoken across pages. No complete English/Chinese route acceptance was inferred from that report.

Inspection of the native tree and full WebView accessibility tree found no raw CSS declarations, color values or pixel-size text. The DOM had no visible style elements or raw formatting text. A likely explanation is TalkBack's text-formatting announcements: [Google documents font size, text color and background color announcements in 16.2](https://support.google.com/accessibility/android/answer/16800105?hl=en). The user can change them under TalkBack → Settings → Verbosity → Speak text formatting / Text formatting options. This diagnosis is supported by the trees and documented behavior, but the personal verbosity preference was not inspected or changed. The reported experience is retained as a qualification limit rather than marked fixed by a code change.

The optional `scripts/test-phone-screen-reader.ps1` snapshots/restores accessibility settings and checks the runner's result, not just ADB's exit status. It requires an explicitly selected physical device and the separate QA package. Do not run it while a human is using the reader.

## Compact local AI

Runtime: WebLLM 0.2.85. Model: `Qwen3.5-4B-q4f16_1-MLC`. Approximate download 2.6 GB, registry GPU-memory estimate 3867.82 MB at 4096-token context, with a 3 GB storage reserve. Settings prepares the optional worker; no separate model server is required. Model weights are downloaded on demand, not redistributed in the APK or EXE.

Synthetic trials of 0.5B, 0.6B, 0.8B, 1.5B and 2B candidates produced malformed/truncated output, copied placeholders, invented corrections or missed omissions. The 4B candidate was the smallest tried that passed the basic written matrix. This is a practical selection from these trials, not a universal model ranking.

Written feedback uses constrained JSON, complete source-clause coverage and evidence IDs mapped to unchanged source/answer text. Generated quotation fields, unknown IDs, incomplete coverage and inconsistent omission scores are rejected. One repair shares the same 120-second deadline. Existing literal-evidence validation still applies, and the UI warns that small-model feedback and scores can be wrong.

The actual worker/provider passed 14 cases: accurate, reversed and unrelated translations, accurate English-to-Chinese, wrong facts/numbers and omission; those six repeated in reverse order; valid paraphrase; and an instruction embedded in the answer. Networking was disabled after preparation, with no POSTs or uncaught page errors. Cached preparation took 4.331 seconds; case latency was 7.503–16.795 seconds, mean 11.875 seconds on this Windows desktop.

The packaged Windows app separately downloaded/prepared the model in 32.518 seconds and returned validated feedback for an accurate synthetic paragraph in 18.364 seconds with networking disabled. It gave a practice estimate of 100 and no corrections for that answer. These single-run timings are observations, not performance guarantees.

After the final review fixes and rebuild, the packaged app rechecked successfully: cached preparation took 3.962 seconds and validated paragraph feedback took 13.516 seconds with networking disabled. Exact draft/localStorage recovery also passed again in the final unpacked runtime.

Limits: the matrix covers basic written English/Chinese discrimination, not calibrated marking. A fluent but inaccurate answer can still have a high aggregate mean because dimensions are independent; review accuracy and the source. Critique explanations and suggested revisions can be wrong even with literal evidence. Other languages, interpreting critique quality, GPU/memory diversity, long answers and model-cache eviction remain outside this matrix. Hindi/Arabic critique and mobile local inference remain gated. Long tasks exceeding the context preflight are rejected. No live cloud provider was qualified.

## Repeatable commands and evidence

| Command | Observed result |
| --- | --- |
| `npm test` | Exit 0; 135 passed, none failed/skipped |
| `npm audit --omit=dev --audit-level=moderate` | Exit 0; zero production vulnerabilities |
| Browser gates | 108 English journey assertions, six Chinese interface checks, two startup recovery checks, two review recovery checks; 82 axe scans with zero violations and ten accessibility interaction checks |
| `npm run package:windows` | Exit 0; final unsigned x64 installer and portable EXE |
| `npm run package:android` | Exit 0; final debug APK; separate QA variant also built and installed successfully |
| `apksigner verify --print-certs` | Exit 0; Android Debug certificate |
| `npm run test:local-reliability` | Exit 0; 14/14 real inference cases |
| `node scripts/desktop-checks.cjs` with packaged executable | Exit 0; exact IndexedDB answer and localStorage marker survive full relaunch at one origin |
| `node scripts/desktop-model-check.cjs` with packaged executable | Exit 0; real worker ready, validated paragraph feedback with networking disabled |

Private local evidence remains in ignored `.browser-qa/`; CI uploads synthetic verification reports separately. Canonical native commands and signing details are in [native-packaging.md](native-packaging.md). The final APK was also installed as an update to the separate QA app. English/Chinese Home, Practice and Settings trees were inspected for raw CSS; none was found. The browser matrix repeats this text-leak check.

Before making the repository public, a local scan inspected 1,690 reachable Git objects, including 752 text blobs. No matches were found for the checked private-key, GitHub-token, provider-token or AWS-key patterns, and no tracked secret-key/environment-file paths were found. This is a bounded pattern scan; it is not a claim that all possible secrets have been detected. Device recordings, profiles, model caches, device-specific logs and package build directories remain ignored.

## PR review follow-up

The final follow-up also fixes pending deletion epochs being accepted by newly opened tabs; one readonly transaction now captures all persisted export stores before sequential audio encoding, with the shared data lock held until completion. This export contains persisted exam rows, not unsaved recovery-journal changes. Explicit deletion retry can finish an interrupted clear; it does not silently reactivate writes.

Local audio import rejects files over 25 MiB before creating a URL and clips over ten minutes after metadata decoding, cleaning up rejected URLs. Leave desk and native Back share the unsaved-take confirmation. A stale remotely cleared tab cannot open an interpreting desk or transfer ownership of an imported URL. Cloud completion paths preserve query parameters and session keys are trimmed. Next-review dates exclude mastered cards. Active interpreting, self-review and expanded exam reports were added to the light/dark, phone/desktop, English/Chinese accessibility matrix.

The Save & Exit review finding was checked through a real production-browser failure injection: evaluation failed and the resumable write rejected, yet the exact answer remained and Save & Exit worked once storage was available. The runner is conditionally unmounted while evaluation runs. This path received regression coverage; no speculative state rewrite was made.

Clean CI initially failed because Electron 44's npm package does not run a binary postinstall. The canonical packaging command now invokes its pinned binary installer before using the custom distribution. Local build and package gates were repeated after the follow-up.

## Remaining work and rollback

No further phone action is required for this bounded pass. Full IME composition, incoming calls/headset interruptions, recording quality, comprehensive Chinese/English reader acceptance and mobile AI qualification remain future acceptance work. Exports are reference-only and cannot restore an installation. Windows is unsigned; Android is debug-signed. A different CI/debug signing key cannot update an existing installation in place.

The ordinary phone app was not installed or reset by these checks. The separate empty QA app can be uninstalled without affecting ordinary app storage. Original reader/rotation settings and microphone permission were restored. Reverting this code does not require a database downgrade; schema 7 remains unchanged. Keep local profiles and signing keys when rebuilding. Export important data before changing experimental packages, and do not uninstall a learner app merely to bypass a signature mismatch.

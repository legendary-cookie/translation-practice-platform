# Lingo Practice

Lingo Practice is a local-first PWA for written, news, and audio interpreting practice across seven languages: Chinese, English, Russian, French, Hindi, Spanish, and Arabic. The first release includes the twelve Chinese-centered directions and works without an account.

## Download 0.1.1

| Platform | Download |
| --- | --- |
| Windows x64 installer | [Setup EXE](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/Lingo-Practice-Setup-0.1.1.exe) |
| Windows x64 portable | [Portable EXE](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/Lingo-Practice-Portable-0.1.1.exe) |
| Android | [Debug APK](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/Lingo-Practice-0.1.1-debug.apk) |
| Integrity | [SHA256SUMS.txt](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/SHA256SUMS.txt) |

These are QA builds: Windows executables are unsigned and the APK uses an Android debug signing key. Android local AI remains disabled; recording, manual transcripts and local study tools work without it. A compatible Windows GPU can prepare the optional local model in Settings. [Release notes](https://github.com/legendary-cookie/translation-practice-platform/releases/tag/v0.1.1).

See the [current verification report](docs/runbooks/2026-10-16-phone-accessibility-and-local-ai.md), [packaging instructions](docs/runbooks/native-packaging.md), and [CI builds](https://github.com/legendary-cookie/translation-practice-platform/actions/workflows/verify-and-package.yml). Export important existing data before changing experimental builds. JSON exports currently have no import/restore flow.

## Run locally

Use Node.js 22 or newer, then install dependencies and start Vite:

```powershell
npm ci
npm run dev
```

Build the installable production bundle with:

```powershell
npm run build
npm run preview
```

Run the behavior regression suite with `npm test`. `npm run build` checks TypeScript and creates the production PWA bundle. Browser QA is a separate gate; passing a build does not qualify a device or inference runtime.

## Adaptive study desk

- Desktop uses a compact collapsible navigation rail and paired source/answer panes. Phones use five primary destinations and explicit source/answer switching; interpreting is available from Home.
- First launch can choose a default language direction, practice level, and learning goal without an account. Settings offers English and Simplified Chinese interfaces; source/answer content supports all seven scripts. Authored passage text, exam-profile names, and model-generated feedback remain in their original languages.
- Light, dark, and device themes, editor text size, and line spacing are saved locally. Ctrl/Command + Enter submits written work; native text editing provides undo/redo. The timer can pause independently of the editor. Exam clocks keep their strict timing rules.
- Written drafts save exact answer text, elapsed time, and an exercise snapshot. A successfully read recovery state and an origin-wide Web Lock protect the singleton draft. A second tab cannot autosave over its owner. A tab claims ownership and reads the latest stored draft before resuming or replacing it. Unsupported or unreadable storage leaves a clearly labeled in-tab practice; it does not overwrite unknown saved work.
- Opening News setup preserves an owned draft. Replacement/discard confirms before losing meaningful work, including unsaved input. Successfully saved completed feedback retires the unfinished draft; failed session saves preserve recovery. All writes are fenced against data deletion, including writes queued by the deleting tab itself.
- The recovered catalog has 96 exercises: four written and four news-style exercises in each of the twelve Chinese-centered directions. The passage selector exposes every filtered exercise. News dates describe fictional practice scenarios, not real reported events.

## Local learning library

Progress includes an editable glossary and mistake notebook with language/skill filters, search, mastery status, and temporary reconstruction self-review. Feedback can save an edited term pair or an evidence-linked revision note. Helpful/Incorrect ratings are attached to a successfully saved session; false positives are excluded from weakness counts without rewriting the original estimate.

Spaced review uses deterministic SM-2 (Again/Hard/Good/Easy map to quality 1/3/4/5, an ease floor of 1.3, and 1/6/ease-based day intervals). Failed recall restarts repetitions. Mastered notes are excluded from due reviews. Enter reveals a card; keys 1–4 grade it when the review panel has focus. These are learner-directed review schedules, not a claim of learning effectiveness or official scoring.

Home suggestions use real saved issues and practice frequency in the latest language direction. Early history is explicitly labeled insufficient for a trend; no starting score or imaginary data point is added. Learning tools perform no AI or network request. Model-generated drills and alternative unqualified model tiers remain outside this release.

IndexedDB schema 7 preserves the earlier stores, including draft, learning-card, and feedback-rating stores. New audio is stored as standalone bytes with a strict transaction commit and reconstructed as a Blob for replay/export; readable legacy Blob records remain supported. Android appearance/language preferences use native Preferences with a WebView mirror hydrated before startup. JSON export version 5 includes local records, the current original catalog, detached snapshots for new written sessions, interpreting audio, exam snapshots, and appearance preferences. Legacy written sessions may not contain a historical passage snapshot; the exported current catalog is a reference for them. API keys remain absent. Export is reference-only; this release has no import/restore flow.

## Browser verification

Start a production preview on `127.0.0.1:4178`, then run the optional browser suite in another terminal:

```powershell
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4178 --strictPort
```

```powershell
npm run test:browser
```

Alternatively, `npm run verify:browser` starts and stops its own production preview and runs English journeys, Chinese interface checks, controlled startup recovery, and axe/keyboard accessibility checks. Port 4178 must be free. Finish all builds before running it so the production files stay stable during the checks.

The project includes `playwright-core`; the suite uses installed Chrome and does not download a browser. Set `QA_BROWSER_CHANNEL` to an installed supported channel when needed. Each suite creates disposable browser data, synthetic fixtures, and loopback-only mock evaluation. It never uses an existing browser profile or real API key. Generated evidence is under ignored `.browser-qa/` (override `BROWSER_QA_ARTIFACTS` if desired). It checks draft recovery/ownership, migration, consent/cancellation/mock feedback, local learning/review/export/deletion, synthetic microphone self-review, denied storage, and offline boot. Mobile viewport checks are browser simulations, not physical Android acceptance.

## Native desktop and Android packages

Build a Windows x64 installer and a portable executable with `npm run package:windows`. Build an Android debug APK with `npm run package:android`; both commands rebuild the same production web app first. See [`docs/runbooks/native-packaging.md`](docs/runbooks/native-packaging.md) for SDK setup, artifact names, signing limits, and device-qualification boundaries.

## Platform support boundary

The release retains the browser PWA, with PNG 192/512px install icons and same-origin offline shell/audio caching. Native packages reuse the same web assets: Electron provides the Windows wrapper and Capacitor provides the Android WebView. Desktop storage keeps one loopback origin across launches and upgrades. Android handles Back navigation and exports JSON through the system document picker. Android 16 emulator checks cover rotation, backgrounding, process relaunch, draft recovery, recording/replay, and exports. The physical Galaxy S25 Ultra passed core lifecycle, draft, Chinese UI and recording/replay checks; reader qualification and remaining limits are recorded in the verification report. Android local-model evaluation remains restricted by the existing mobile capability gate. No silent analytics, account, synchronization, or cloud inference is introduced.

## Local evaluation

Open Settings and choose **Prepare local model**. The app downloads the optional model once and runs it in its worker. No separate AI server is required.

- Runtime: `@mlc-ai/web-llm` `0.2.85`
- Model: `Qwen3.5-4B-q4f16_1-MLC`
- Approximate download: 2.6 GB; registry GPU memory estimate: 3867.82 MB with the 4096-token context.

Smaller 0.5B, 0.6B, 0.8B, 1.5B and 2B candidates produced rejected JSON, copied examples, invented corrections, or missed omissions in synthetic trials. The compact 4B candidate passed the current 14-case English/Chinese written check, including repeated cases, valid alternative phrasing and an instruction embedded in the learner answer. The check disables networking after preparation. These results cover basic task discrimination and structural reliability on one Windows GPU; they do not calibrate scores or qualify every exercise, language or device.

Written evaluation uses constrained JSON, a coverage check for every source clause, and evidence IDs resolved to unchanged input text. Unknown IDs, invented quotes, missing coverage, inconsistent omission scores, malformed output, truncation and deadline failures are rejected before saving feedback. One repair attempt shares the same 120-second evaluation deadline. The existing domain validator still checks the resolved literal evidence. Quoted text can be correct while the explanation or suggested revision is wrong; the UI includes an explicit small-model warning.

The local worker remains optional. Devices without WebGPU/storage are unavailable; mobile and weak-memory devices remain restricted until qualified. Hindi and Arabic local critique remain disabled. Interpreting uses verified transcripts and never infers speech quality from audio amplitude. Its model critique quality remains outside the written matrix. Cloud fallback still requires exact-task, payload and destination consent.

On Android WebView, on-device speech-recognition probing is disabled. WebView 154 on the physical Samsung phone exposed the API but terminated its renderer when the native speech binder was missing. Manual transcripts and local recording/replay remain available; the default remote speech service is never used.

Run `npm run test:local-reliability` for the optional GPU/model matrix. It starts an owned loopback development server and isolated Electron qualification host. It downloads weights into a disposable profile and reports results in `.browser-qa/local-reliability-results.json`. Standard CI does not claim GPU inference or physical-device acceptance. See [the verification report](docs/runbooks/2026-10-16-phone-accessibility-and-local-ai.md) for current evidence and limits.

## Cloud opt-in

Cloud fallback is optional and uses a user-configured OpenAI-compatible `baseUrl`, model name, and API key. Remote endpoints must use HTTPS; plain HTTP is accepted only for exact loopback hosts (`localhost`, `127.0.0.1`, or `::1`) used by local OpenAI-compatible servers. The endpoint and model preference may be stored locally; the API key is held in memory for the current tab only and is never stored in IndexedDB or included in exports.

If local-first with cloud fallback is selected and local evaluation cannot run, the app opens a task-specific consent step. It shows the exact source passage and learner answer that would be sent. Cloud evaluation starts only after the learner confirms that step. Provider output is validated before it can be displayed or stored.

## Offline and privacy boundaries

- Exercises, settings, completed sessions, progress, and exports are local to the current browser/device.
- The service worker caches the same-origin app shell and falls back to the cached entry point for navigation. It does not cache `fetch` requests, evaluation requests, API responses, or cross-origin content.
- Previously cached app content remains available offline. AI feedback is offline only after the local model has been prepared and the device supports it.
- Export creates a versioned JSON file from local records. Deletion requires explicit confirmation and clears local settings, sessions, interpreting history, and recordings.
- Scores are practice estimates. They are not official CATTI or MTI results.

## Audio interpreting mode

- **Source playback**: The interpreting catalog contains short, platform-authored scripts rendered into same-origin WAV assets. Rights metadata records the exact hash, duration, MIME type, provenance, and permitted use for every clip. The service worker precaches these assets; it never proxies remote audio.
- **Local source import**: Setup can import a browser-readable `audio/*` file into a device-local object URL, read its duration and MIME type, and accept an optional source transcript. The imported bytes are kept local until a completed session is saved; a saved session keeps the source snapshot and IndexedDB reference so self-review can reopen it.
- **Listen, prepare, deliver**: Consecutive mode requires listening to each authored segment before recording. Simultaneous mode records one continuous local take with approximate segment boundaries. Source transport, native fallback controls, seek, repeat, microphone state, input level, pause/stop, local replay, and discard are touch- and keyboard-accessible.
- **Microphone boundary**: Recording is requested only from the explicit record action and requires localhost or HTTPS plus browser permission. `MediaRecorder` chooses a runtime-supported MIME type. Permission, device, secure-context, and codec errors remain visible; every microphone track and replay object URL is released on stop, discard, navigation, and unmount.
- **Local evidence**: Takes remain in memory until submission, then are saved in IndexedDB with their recording metadata and referenced by the saved interpreting session. Progress can reopen a saved self-review with local replay evidence. Export includes short audio as browser-safe data URLs; deleting local data clears recordings, sessions, settings, and interpreting history together.
- **Scoreless self-review and recovery**: Learners can save a local self-review without automated evaluation or a fabricated transcript/score. If IndexedDB cannot save it, the exact pending session remains available for an explicit retry in the current tab; saved takes can be reopened and deleted individually, with shared recordings retained only while referenced.
- **Recognition and feedback**: On-device Web Speech is an optional capability check that requires `processLocally: true`; it never falls back to default remote recognition. Unsupported or low-confidence languages use manual transcript confirmation and explicitly labeled incomplete content feedback. Delivery metrics are local heuristics, separate from content scores, and every result is a practice estimate rather than an official CATTI/MTI result.
- **Cloud boundary**: Local-only mode sends no source transcript, learner transcript, learner audio, or derived metrics remotely. A configured cloud provider is offered only after a task-specific consent view names the endpoint/model and exact text, audio MIME/duration/bytes, and delivery-metric payload. Cancelling or failing that request leaves the audio and transcript on this device; there is no automatic remote speech processing.

## Included practice modes

- **Written translation**: Sentence- and paragraph-level deliberate practice focusing on accuracy, terminology, and natural phrasing.
- **News translation**: Practice with original, current-affairs style passages categorized by domain.
- **Exam simulation**: Realistic, timed mock examinations for CATTI candidates and named-university MTI profiles with strict test conditions, dual countdown timers, crash recovery, and multi-section consolidated evaluations.

## Exam simulation mode

The exam simulator provides an authentic testing experience tailored to individual candidates:

### 1. Versioned Exam Profiles & Dated Syllabus References
- **CATTI Level 2 English 实务 (`catti-2-practical-en-zh-v1`)** [2023-12-25 official syllabus baseline]: 180 minutes; about 900 English words for English-to-Chinese (50 pts) and about 600 Chinese characters for Chinese-to-English (50 pts). The score shown by this app remains a practice estimate.
- **CATTI Level 2 French 实务 (`catti-2-practical-fr-zh-v1`)** [2023-12-25 official syllabus baseline]: 180 minutes; about 800 French words for French-to-Chinese (60 pts) and about 500 Chinese characters for Chinese-to-French (40 pts). The score shown by this app remains a practice estimate.
- **CATTI Level 2 Arabic 实务 (`catti-2-practical-ar-zh-v1`)** [2023-12-25 official syllabus baseline]: 180 minutes; about 700–800 Arabic words for Arabic-to-Chinese (60 pts) and about 400–500 Chinese characters for Chinese-to-Arabic (40 pts), with RTL rendering. The score shown by this app remains a practice estimate.
- **CATTI Russian and Spanish references**: The dated 2023-12-25 syllabus baselines are about 800 Russian words / 400 Chinese characters and about 800 Spanish words / 500 Chinese characters, both with 60/40 point weighting. No Russian or Spanish passage packs are bundled in this slice yet.
- **MTI 357**: No generic national profile is bundled. MTI 357 task counts and structures vary by named university and admission year; a profile must be tied to both before it is offered.
- **Hindi Scope Boundary**: CATTI does not administer Hindi examinations; Hindi is intentionally excluded from CATTI simulation profiles.

### 2. Permitted Aids & Strict Mode
- **CATTI Aids Policy**: The 2023-12-25 profile references are dated syllabus baselines; consult the target administration's official notice for current aids.
- **MTI Aids Policy**: A named university and admission-year profile must provide its own current policy; no generic MTI policy is asserted here.
- **Strict Client Ergonomics**: Inline glossaries, vocabulary tooltips, and interactive AI hints are hidden during the test. Clipboard restriction is a platform simulation choice, not an official universal CATTI rule.

### 3. Dual Timers & Crash Recovery
- **Dual Timers**: Live tracking of current section countdown and overall exam countdown, using wall-clock time diffing to prevent timer drift when tabs are backgrounded.
- **Auto-Save & Recovery**: Draft answers and remaining seconds auto-save to IndexedDB every 3 seconds and on blur. Saved checkpoints can be resumed after reload; an abrupt closure can still lose changes made since the latest successful save, and storage errors remain visible.
- **Auto-Advance & Auto-Submit**: Sections auto-lock when section time expires; overall exam timer auto-submits when total time hits zero.

### 4. Consolidated Evaluation & Mandatory Practice Disclaimer
- Submissions are evaluated across five platform-authored rubric dimensions (`accuracy`, `terminology`, `grammar`, `fluency`, `taskStyle`) and aggregated into a scaled practice score. No official marker-consensus sheet, micro-deduction table, or official threshold is claimed.
- **Threshold nuance**: CATTI's default fixed standard is not a universal rule for every administration and region; the 2024 separate-line exception was 58. The simulator's benchmark is only a practice comparison.
- **Mandatory Practice Disclaimer**: Every score and summary is explicitly labeled as an automated practice estimate. No official endorsement, certification, or affiliation with CIPG (中国外文局), ATICICG (翻译院), CPTA (人事考试网), or any MTI university is implied.
- **Materials policy**: This release uses platform-authored practice passages and does not reproduce past exam papers. Ownership of past papers is not asserted; rights must be checked paper by paper before reuse.

Arabic source and answer fields set `dir="rtl"`; all supported scripts use touch-sized controls and responsive layouts for narrow phones and laptops. The app uses system fonts and local SVG/PNG icons, with no remote font or image dependency.


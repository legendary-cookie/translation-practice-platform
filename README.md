# Lingo Practice

Lingo Practice is a local-first PWA for written, news, and audio interpreting practice across seven languages: Chinese, English, Russian, French, Hindi, Spanish, and Arabic. The first release includes the twelve Chinese-centered directions and works without an account.

## Run locally

Use Node.js 20.19+ (or a current compatible release), then install dependencies and start Vite:

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
- First launch can choose a default language direction, practice level, and learning goal without an account. Interface copy is currently English; source/answer content supports all seven scripts.
- Light, dark, and device themes, editor text size, and line spacing are saved locally. Ctrl/Command + Enter submits written work; native text editing provides undo/redo. The timer can pause independently of the editor. Exam clocks keep their strict timing rules.
- Written drafts save exact answer text, elapsed time, and an exercise snapshot. A successfully read recovery state and an origin-wide Web Lock protect the singleton draft. A second tab cannot autosave over its owner. A tab claims ownership and reads the latest stored draft before resuming or replacing it. Unsupported or unreadable storage leaves a clearly labeled in-tab practice; it does not overwrite unknown saved work.
- Opening News setup preserves an owned draft. Replacement/discard confirms before losing meaningful work, including unsaved input. Successfully saved completed feedback retires the unfinished draft; failed session saves preserve recovery. All writes are fenced against data deletion, including writes queued by the deleting tab itself.
- The recovered catalog has 96 exercises: four written and four news-style exercises in each of the twelve Chinese-centered directions. The passage selector exposes every filtered exercise. News dates describe fictional practice scenarios, not real reported events.

## Local learning library

Progress includes an editable glossary and mistake notebook with language/skill filters, search, mastery status, and temporary reconstruction self-review. Feedback can save an edited term pair or an evidence-linked revision note. Helpful/Incorrect ratings are attached to a successfully saved session; false positives are excluded from weakness counts without rewriting the original estimate.

Spaced review uses deterministic SM-2 (Again/Hard/Good/Easy map to quality 1/3/4/5, an ease floor of 1.3, and 1/6/ease-based day intervals). Failed recall restarts repetitions. Mastered notes are excluded from due reviews. Enter reveals a card; keys 1–4 grade it when the review panel has focus. These are learner-directed review schedules, not a claim of learning effectiveness or official scoring.

Home suggestions use real saved issues and practice frequency in the latest language direction. Early history is explicitly labeled insufficient for a trend; no starting score or imaginary data point is added. Learning tools perform no AI or network request. Model-generated drills and alternative unqualified model tiers remain outside this release.

IndexedDB schema 6 preserves the earlier stores and adds draft, learning-card, and feedback-rating stores. JSON export version 5 includes those records, the current original catalog, detached snapshots for new written sessions, interpreting audio, exam snapshots, and appearance preferences. Legacy written sessions may not contain a historical passage snapshot; the exported current catalog is a reference for them. API keys remain absent. Export is reference-only; this release has no import/restore flow.

## Browser verification

Start a production preview on `127.0.0.1:4178`, then run the optional browser suite in another terminal:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4178 --strictPort
```

```powershell
# Use an existing Playwright installation; no test-runner dependency is added.
$env:PLAYWRIGHT_MODULE_PATH = '<absolute path to the installed playwright module>'
npm run test:browser
```

On Windows the suite uses installed Chrome. Set `QA_BROWSER_CHANNEL` to an installed supported channel when needed. Each suite creates disposable browser data, synthetic fixtures, and loopback-only mock evaluation. It never uses an existing browser profile or real API key. Generated evidence is under ignored `.browser-qa/` (override `BROWSER_QA_ARTIFACTS` if desired). It checks draft recovery/ownership, migration, consent/cancellation/mock feedback, local learning/review/export/deletion, synthetic microphone self-review, denied storage, and offline boot. Mobile viewport checks are browser simulations, not physical Android acceptance.

## Platform support boundary

The release retains the browser PWA, with PNG 192/512px install icons and same-origin offline shell/audio caching. Windows Chrome browser behavior is testable here; native Windows packages, APK distribution, physical Android back/keyboard/rotation behavior, screen-reader qualification, real microphone behavior, and refreshed real-device/model performance are not certified by these tests. A wrapper is deferred until its WebGPU, storage, and audio behavior can be measured. No silent analytics, account, synchronization, or cloud inference is introduced.

## Local evaluation

Open Settings and choose **Prepare local model** to download and cache the pinned WebLLM runtime/model combination:

- `@mlc-ai/web-llm` `0.2.82`
- `Qwen3-1.7B-q4f16_1-MLC`

Preparation requires a browser with WebGPU and enough memory for the model. The model runs in a web worker. Preparation progress, cache state, ready state, and recoverable errors are shown in Settings. Device support, browser policy, available memory, and integrated-GPU limits can still make local inference unavailable.

The app detects a runtime capability tier before offering local evaluation. Devices without WebGPU or enough storage are L0 and unavailable; iOS, Android, and devices without a strong memory signal remain restricted at L1 until real-device validation proves the model safe and useful; supported desktop-class devices can reach L2 after preflight. Hindi and Arabic directions remain manual-review or explicit-cloud-consent tasks because Qwen3's listed language support does not establish useful 1.7B critique quality. If a previously prepared model disappears from browser storage, Settings reports the missing cache instead of silently falling back.

On 2026-10-12, standalone external Chrome reported WebGPU available, an L2 desktop capability, a 32 GiB coarse device-memory signal, and 10.0 GiB estimated origin headroom. With the pinned `0.2.82` build, an unconstrained control completed in about 355 ms and a prompt-only JSON control in about 1.03 s after the model was ready. A realistic 91-character Chinese source and 55-word English answer completed with visible feedback in 53.4 s on one run and 74.2 s on a clean rerun. A later warm-cache run completed in 24.8 s. This spread is material: these are measurements on one strong desktop, not a latency promise; phone viability remains unproven.

The local evaluator uses streamed, prompt-only JSON rather than WebLLM `response_format: { type: "json_object" }`: on this pinned build the constrained request reached stream initialization but stalled before its first token, while prompt-only generation streamed normally. The response is parsed as one complete JSON document and validated before any score is displayed or saved. A malformed, semantically invalid, or `finish_reason: "length"` response gets one bounded deterministic retry; if that also fails, the learner sees an explicit no-score error and can review manually or choose the existing per-task cloud-consent path. The output cap is 1,400 tokens, above the observed rubric response, but longer inputs can still exceed the model's context budget.

Qwen3 non-thinking mode is sent explicitly on every local request as WebLLM's `extra_body.enable_thinking: false`. WebLLM exposes that field in the chat-completion generation configuration and maps it from `request.extra_body`; Qwen's model card says `enable_thinking=False` disables reasoning. This pinned runtime still emitted an empty `<think>` wrapper in the observed response, so the parser removes that wrapper defensively. See the [WebLLM API reference](https://github.com/mlc-ai/web-llm/blob/main/docs/user/api_reference.rst), [WebLLM engine mapping](https://github.com/mlc-ai/web-llm/blob/main/src/engine.ts), and [Qwen3 model card](https://huggingface.co/Qwen/Qwen3-8B#switching-between-thinking-and-non-thinking-mode), all checked 2026-10-12.

The model reached ready state and produced results only in standalone external Chrome during this investigation. AO's Electron-based preview stalled during WebLLM reload/model initialization before engine-ready, so that preview is not evidence that the local path works or fails in a supported browser. The `0.2.86` upgrade remains unvalidated, not refuted; `0.2.82` stays pinned. The earlier `0.2.83`/`0.2.84` long-prompt regression still requires a controlled comparison: <https://github.com/mlc-ai/web-llm/issues/844> (checked 2026-10-12).

When local-only mode is selected, an unavailable local model stops evaluation with an explanation. The app does not send practice text or answers to a cloud service in that mode.

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


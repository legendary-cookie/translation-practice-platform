# Lingo Practice

Lingo Practice is a local-first PWA for written, news, and audio interpreting practice across seven languages: Chinese, English, Russian, French, Hindi, Spanish, and Arabic. The first release includes the twelve Chinese-centered directions and works without an account.

## New to the app?

Follow the [getting-started instructions below](#getting-started) for installation, your first exercise, larger text, saved work, and speaking practice. No coding knowledge or AI setup is needed to begin. You can also open the [guide on its own page](docs/USER-GUIDE.md).

## Download 0.1.1

| Platform | Download |
| --- | --- |
| Windows x64 installer | [Setup EXE](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/Lingo-Practice-Setup-0.1.1.exe) |
| Windows x64 portable | [Portable EXE](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/Lingo-Practice-Portable-0.1.1.exe) |
| Android | [Debug APK](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/Lingo-Practice-0.1.1-debug.apk) |
| Integrity | [SHA256SUMS.txt](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/SHA256SUMS.txt) |

These are QA builds: Windows executables are unsigned and the APK uses an Android debug signing key. Android local AI remains disabled; recording, manual transcripts and local study tools work without it. A compatible Windows GPU can prepare the optional local model in Settings. [Release notes](https://github.com/legendary-cookie/translation-practice-platform/releases/tag/v0.1.1).

See the [current verification report](docs/runbooks/2026-10-16-phone-accessibility-and-local-ai.md), [packaging instructions](docs/runbooks/native-packaging.md), and [CI builds](https://github.com/legendary-cookie/translation-practice-platform/actions/workflows/verify-and-package.yml). Export important existing data before changing experimental builds. JSON exports currently have no import/restore flow.

## Getting started

<!-- Keep these beginner instructions aligned with docs/USER-GUIDE.md. -->

This guide is for anyone who wants clear steps, even if they rarely install apps. You do not need an account or a password to study.

**Start here:** install the app, open **Practice**, choose a passage, and write a translation. You can do this without setting up AI.

In this guide, **choose** means click once with a mouse, or tap once on a phone. Words in **bold** match buttons or labels in the English app.

### Find the help you need

- [Install on a Windows computer](#install-on-a-windows-computer)
- [Install on an Android phone](#install-on-an-android-phone)
- [Make the app comfortable to read](#make-the-app-comfortable-to-read)
- [Do your first written exercise](#do-your-first-written-exercise)
- [Get optional AI feedback](#get-optional-ai-feedback)
- [Find your saved work](#find-your-saved-work)
- [Practise speaking and listening](#practise-speaking-and-listening)
- [Try an exam simulation](#try-an-exam-simulation)
- [Keep your work safe](#keep-your-work-safe)
- [Solve a problem](#solve-a-problem)

### Install on a Windows computer

Use a Windows computer that supports x64 apps. These downloads do not install on a Mac, an iPhone, or an iPad.

1. Open the [Lingo Practice 0.1.1 download page](https://github.com/legendary-cookie/translation-practice-platform/releases/tag/v0.1.1).
2. Find **Assets** near the bottom of the page. If the file list is closed, choose **Assets** to open it.
3. Choose **Lingo-Practice-Setup-0.1.1.exe**. You can also use this [direct Windows installer download](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/Lingo-Practice-Setup-0.1.1.exe).
4. Wait for the download to finish. Open your **Downloads** folder and double-click that file.
5. Follow the installation window's instructions. When installation finishes, open **Lingo Practice** from the Windows Start menu.

This is an early test release. Windows may show an unknown-publisher warning because the installer has no publisher signature. Check that you downloaded the exact file linked above. If Windows blocks it and you are unsure, stop and ask someone you trust to help; you do not need to turn off Windows security.

**Which file should I pick?** Use **Setup** for a normal installation. **Portable** is an alternative executable that runs without the normal installation steps. You only need one. The **Source code** downloads are for people working on the app's code.

### Install on an Android phone

An **APK** is an Android app installation file. This release is downloaded from GitHub, rather than installed through Google Play.

1. On your phone, open the [Lingo Practice 0.1.1 download page](https://github.com/legendary-cookie/translation-practice-platform/releases/tag/v0.1.1).
2. Under **Assets**, choose **Lingo-Practice-0.1.1-debug.apk**. Here is the [direct Android download](https://github.com/legendary-cookie/translation-practice-platform/releases/download/v0.1.1/Lingo-Practice-0.1.1-debug.apk).
3. Wait for the download to finish. Open the downloaded file from your browser's downloads or your phone's file app.
4. Android may ask whether the browser or file app is allowed to install this download. Read the message carefully. Allow installation from that app only if you trust the download linked above. The wording varies between phones.
5. Choose **Install**, then **Open**. Later, open **Lingo Practice** from your phone's app list.
6. If you enabled permission to install from that browser or file app, you can turn it off again afterward in the phone's settings.

The word **debug** is part of this test release's filename. The file ending in **qa.apk** installs a separate app used for checks; choose **debug.apk** for ordinary use.

If the phone refuses an update because it conflicts with an existing app, **keep your existing app installed** and ask for help. Uninstalling it may remove your saved work. See [Keep your work safe](#keep-your-work-safe).

### Make the app comfortable to read

If a welcome screen appears, choose your language direction, practice level, and learning goal. **Everyday practice** is a simple place to begin. You can change these choices later.

Open **Settings**, then find **Appearance and reading**:

| Setting | What to choose |
| --- | --- |
| **语言 / Language** | **English** or **简体中文** for the buttons and menus. |
| **Editor text size** | Try **20px** or **24px** if the passage or answer text feels small. A larger number means larger text. |
| **Line spacing** | Try **Spacious** for more room between lines. |
| **Theme** | **Light**, **Dark**, or **Follow device**. Choose whichever is easier to read. |
| **Default language direction** | The language you read, followed by the language you write. |

For example, **Chinese → English** means read Chinese and write English. Changing the menu language does not translate the exercise text or your answer.

#### Find your way around

On a computer, navigation is on the left. On a phone, the main buttons are at the bottom. If you use the Chinese interface, these are the matching names:

| English | Chinese | What you can do there |
| --- | --- | --- |
| **Home** | **首页** | Start something new or continue a saved written draft. |
| **Practice** | **练习** | Read a passage and type a translation. |
| **Exam** | **考试** | Try a timed exam simulation. |
| **Progress** | **进度** | See completed work and learning notes. |
| **Settings** | **设置** | Change reading options, prepare optional AI, or export records. |

For speaking and listening practice on a phone, open **Home** and choose **Interpreting** (**口译**).

### Do your first written exercise

Allow yourself a few quiet minutes. There is no need to finish quickly.

1. Choose **Practice**.
2. Leave **Practice mode** on **Written translation**.
3. Choose your **Language direction**. The arrow points from the language you read to the language you write.
4. For a first attempt, try **Beginner** under **Difficulty** and **Untimed** under **Timing**. Leave **Topic** on **All topics**. If no passage appears, choose **Any difficulty**.
5. Choose a **Passage**, then **Open translation desk**.
6. Read the original passage under **Source**. Type your translation in **Your translation**.
7. On a phone, use **Read source** and **Write answer** to switch between the two. The **Glossary** provides notes about some words or phrases.
8. Look below the answer for **Draft saved on this device** before closing the app. If it says **Saving draft…**, wait. If it says **Draft not saved**, keep the app open and copy your answer into another document before leaving.

You have now started a practice exercise. A draft is an unfinished answer. Return to **Home** and choose **Continue translation** to reopen it on this device.

The app keeps one unfinished written draft. Read any replacement or discard message carefully when starting another passage.

To request an AI review, choose **Submit for feedback** after setting up the optional feature below. Without AI, you can still write, save a draft, and review your wording yourself. An unfinished draft appears through **Continue translation**; it is not a completed result in **Progress**.

### Get optional AI feedback

AI can suggest improvements, but it can also misunderstand a good translation. Scores marked **Practice estimate** are study suggestions. They are not official exam marks.

#### On a compatible Windows computer

1. Connect to the internet. The first model download is about **2.6 GB**, so use a connection with enough data available.
2. Open **Settings** and choose **Prepare local model**. A *model* is the AI program used to review your answer.
3. Leave the app open while preparation finishes. The computer needs a supported graphics processor and enough storage and graphics memory. If the app says **Local model unavailable**, skip this feature on that device.
4. When preparation is ready, return to your written exercise and choose **Submit for feedback**.
5. Wait for feedback or an error message. Read each suggestion alongside the original passage. Keep changes only when they make sense to you.

Once downloaded and available on the computer, the local model can work without sending your practice text to an online AI service. If its downloaded files are removed, prepare it again when connected to the internet.

Local feedback is currently unavailable for Hindi and Arabic. The basic checks for this release cover English/Chinese written work; feedback quality in other supported directions can vary.

#### On an Android phone

This release does **not** run local AI on Android. You can write translations, keep a draft, use learning notes, and save interpreting self-reviews without it.

**Cloud** means an online AI service. Setting it up is an advanced, optional feature that needs your own provider details and access key, and may involve provider charges. You can leave those settings alone. The app asks before sending a task and shows what would be sent and where. Choose **Cancel** if you do not want to send it.

### Find your saved work

- **Unfinished written answer:** open **Home**, then **Continue translation**.
- **Completed written feedback:** open **Progress**, then **Daily Practice**.
- **Saved speaking practice:** open **Progress**, then **Interpreting**, then **Open saved self-review** on the record you want.
- **Exam results:** open **Progress**, then **Mock Exam Simulations**.

In **Progress**, scroll to **Your learning library**. The **Glossary** holds word pairs you save. The **Mistake notebook** holds notes about things you want to improve.

To keep a useful word or correction:

1. Choose **Glossary** or **Mistake notebook**.
2. In **Add a term** or **Add a revision note**, choose the source and target languages.
3. Fill in **Source**, **Translation or revision**, and any **Your notes** you want to remember.
4. Choose **Save card**.

To revisit saved notes, choose **Review** (the button also shows how many cards are due), try to remember the answer, then choose **Reveal translation**. Choose **Again**, **Hard**, **Good**, or **Easy** to describe how well you remembered it.

An empty Progress page is normal before you have saved completed work.

### Practise speaking and listening

Interpreting means listening in one language and speaking the meaning in another. You can save this practice without AI or a score.

1. Open **Home**, then **Interpreting**.
2. Choose your language direction and an exercise. Start with **Consecutive · listen then deliver**: you listen first, then speak.
3. Choose **Open interpreting desk**.
4. Choose **Play segment** and listen to that part of the passage.
5. Choose **Start recording**. If the device asks, allow microphone access for this practice. Speak your translation.
6. Choose **Stop and save**, then use **Replay this take** to listen to yourself.
7. In **Editable response transcript**, type what you said if you want a written record. Android uses this manual route; automatic transcription is unavailable there.
8. Choose the next numbered segment and repeat. Each segment needs a recording or must be marked **I am skipping this segment** before the final save button becomes available.
9. Choose **Save self-review without a score**. Wait for confirmation that the session was saved before leaving.

**Do not stop at “Stop and save.”** That button keeps the take in the open desk. Use **Save self-review without a score** to keep the session for a later visit. Leaving earlier can discard recordings and transcript changes; read any warning before confirming.

### Try an exam simulation

This is optional. Begin with ordinary Practice if you want to learn the controls first.

1. Open **Exam** and choose an exam profile.
2. Read the sections and time limits, then choose **Start Exam Simulation** when ready.
3. Follow the section instructions. Exam clocks have stricter timing than ordinary practice.
4. Use **Save & Exit** if you need to stop, and wait for the saved confirmation. Return to **Exam** to resume the saved run.
5. Use **Submit Exam** when finished. AI evaluation needs a supported prepared model or a separately approved cloud request.

These are practice simulations. Results do not certify a CATTI or MTI qualification or replace current official exam instructions.

### Keep your work safe

Your work is saved **on the device and in the app you used**. It does not automatically move between a phone and a computer. Using the website in another browser also gives you a different set of saved work.

- Before closing written practice, check that the draft was saved.
- Do not uninstall the app or clear its app/browser data if you want to keep your work.
- Before changing test builds, keep a readable copy of important answers in a document of your own. There is no automatic app updater.
- **Settings → Export local JSON** saves a file containing stored practice records, including saved recordings. A JSON file is a structured text file; you do not need to edit it. On Android, choose a folder and confirm the file save when the phone asks.
- **Exports are reference copies only. This release cannot import them to restore your work.** An export does not include every change still waiting to be saved. It also does not transfer your work into the app on another device.
- Keep exported files somewhere private, because they may contain your answers and recordings.
- **Delete local data** permanently removes saved work. Choose **Keep local data** if you opened the deletion question by mistake.

### Solve a problem

| What you see | What to do |
| --- | --- |
| No passage to choose | Set **Topic** to **All topics** and **Difficulty** to **Any difficulty**. |
| **Draft not saved** | Keep the app open. Copy your answer to a separate document. Read the message before closing or reloading. |
| An empty history or a history error | Check that you opened the same app on the same device. If a read error is shown, use its retry button; an error does not mean your records were deleted. |
| **Local model unavailable**, or feedback fails | You can continue studying manually. On Windows, read the reason in **Settings**. On Android, local AI is unavailable in this release. |
| The microphone does not work | Check microphone permission for Lingo Practice in your device settings, then try **Start recording** again. Written practice does not need the microphone. |
| **Start recording** says **Listen first** | Play the current source segment before recording in consecutive mode. |
| The self-review save button is unavailable | Finish recording or mark skipped segments, then wait for any preparation to finish. Read any message shown on the desk. |
| A screen reader announces colours or text sizes | This may be the reader's formatting-announcement setting. Ask a helper to check that setting if needed. Full screen-reader support is still being checked in this release. |
| An installation or update is refused | Keep any existing app and data. Note the exact message and ask for help before uninstalling anything. |

If you need help, [open a GitHub issue](https://github.com/legendary-cookie/translation-practice-platform/issues) or ask the person who helped you install the app. Explain what you chose, what you expected, and what appeared. Include Windows or Android and the app version, **0.1.1**. Leave out private answers, recordings, and access keys.

For technical details and known limits, see the [release notes](https://github.com/legendary-cookie/translation-practice-platform/releases/tag/v0.1.1) and [verification report](docs/runbooks/2026-10-16-phone-accessibility-and-local-ai.md).

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

Exports read persisted stores from one readonly database snapshot before encoding audio, while the data lock prevents deletion from crossing the operation. Unsaved exam recovery journals are not a backup snapshot. An interrupted deletion blocks new writes until an explicit deletion retry completes. Imported source audio is limited to 25 MiB and ten minutes before opening a practice desk.

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


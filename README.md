# Lingo Practice

Lingo Practice is a local-first PWA for written and news translation practice across seven languages: Chinese, English, Russian, French, Hindi, Spanish, and Arabic. The first release includes the twelve Chinese-centered directions and works without an account.

## Run locally

Use Node.js 20.19+ (or a current compatible release), then install dependencies and start Vite:

```powershell
npm install
npm run dev
```

Build the installable production bundle with:

```powershell
npm run build
npm run preview
```

The production build is the packaging check for this release. Automated tests are intentionally not included in this pass.

## Local evaluation

Open Settings and choose **Prepare local model** to download and cache the pinned WebLLM runtime/model combination:

- `@mlc-ai/web-llm` `0.2.82`
- `Qwen3-1.7B-q4f16_1-MLC`

Preparation requires a browser with WebGPU and enough memory for the model. The model runs in a web worker. Preparation progress, cache state, ready state, and recoverable errors are shown in Settings. Device support, browser policy, available memory, and integrated-GPU limits can still make local inference unavailable.

When local-only mode is selected, an unavailable local model stops evaluation with an explanation. The app does not send practice text or answers to a cloud service in that mode.

## Cloud opt-in

Cloud fallback is optional and uses a user-configured OpenAI-compatible `baseUrl`, model name, and API key. The endpoint and model preference may be stored locally; the API key is held in memory for the current tab only and is never stored in IndexedDB or included in exports.

If local-first with cloud fallback is selected and local evaluation cannot run, the app opens a task-specific consent step. It shows the exact source passage and learner answer that would be sent. Cloud evaluation starts only after the learner confirms that step. Provider output is validated before it can be displayed or stored.

## Offline and privacy boundaries

- Exercises, settings, completed sessions, progress, and exports are local to the current browser/device.
- The service worker caches the same-origin app shell and falls back to the cached entry point for navigation. It does not cache `fetch` requests, evaluation requests, API responses, or cross-origin content.
- Previously cached app content remains available offline. AI feedback is offline only after the local model has been prepared and the device supports it.
- Export creates a versioned JSON file from local records. Deletion requires explicit confirmation and clears local settings and sessions.
- Scores are practice estimates. They are not official CATTI or MTI results.

## Included practice modes

- **Written translation**: Sentence- and paragraph-level deliberate practice focusing on accuracy, terminology, and natural phrasing.
- **News translation**: Practice with original, current-affairs style passages categorized by domain.
- **Exam simulation**: Realistic, timed mock examinations for CATTI and MTI candidates with strict test conditions, dual countdown timers, crash recovery, and multi-section consolidated evaluations.

## Exam simulation mode

The exam simulator provides an authentic testing experience tailored to individual candidates:

### 1. Versioned Exam Profiles & Syllabi
- **CATTI Level 2 English 实务 (`catti-2-practical-en-zh-v1`)** [Verified]: 180 minutes total; 100 max points; pass threshold 60/100 points. Section 1: English-to-Chinese (2 passages, ~940 words total, 50 pts); Section 2: Chinese-to-English (2 passages, ~600 characters total, 50 pts).
- **MTI 357 English Foundation Guidance Baseline (`mti-357-foundation-en-zh-v1`)** [Provisional Draft]: 180 minutes total; 150 max points; Section 1: Terminology Translation (15 E->C, 15 C->E, 30 pts); Section 2: English-to-Chinese Passage (~320 words, 60 pts); Section 3: Chinese-to-English Passage (~220 characters, 60 pts). Labeled as National MTI Steering Committee guidance template; specific university variations apply.
- **CATTI Level 2 French 实务 (`catti-2-practical-fr-zh-v1`)** [Provisional Draft]: 180 minutes; 100 max points (60 pts French->Chinese, 40 pts Chinese->French); 4 original passages.
- **CATTI Level 2 Arabic 实务 (`catti-2-practical-ar-zh-v1`)** [Provisional Draft]: 180 minutes; 100 max points; 50/50 point weighting; 4 original passages with bidirectional Right-to-Left (RTL) Arabic rendering.
- **Hindi Scope Boundary**: CATTI does not administer Hindi examinations; Hindi is intentionally excluded from CATTI simulation profiles.

### 2. Permitted Aids & Strict Mode
- **CATTI Aids Policy**: In real CATTI 《笔译实务》 computer examinations, candidates are permitted up to two printed paper bilingual general dictionaries. Electronic dictionaries, specialized terminology glossaries, and online searches are strictly prohibited.
- **MTI Aids Policy**: Strictly closed-book (闭卷); no dictionaries or external reference materials are permitted.
- **Strict Client Ergonomics**: Inline glossaries, vocabulary tooltips, and interactive AI hints are completely hidden during the test. Direct copying from the source text and pasting into answer textareas are locked to simulate real CATTI testing terminals.

### 3. Dual Timers & Crash Recovery
- **Dual Timers**: Live tracking of current section countdown and overall exam countdown, using wall-clock time diffing to prevent timer drift when tabs are backgrounded.
- **Auto-Save & Recovery**: Draft answers and remaining seconds auto-save to IndexedDB every 3 seconds and on blur. Browser reloads or unexpected closures can be resumed immediately with zero data loss.
- **Auto-Advance & Auto-Submit**: Sections auto-lock when section time expires; overall exam timer auto-submits when total time hits zero.

### 4. Consolidated Evaluation & Mandatory Practice Disclaimer
- Submissions are evaluated across five core rubric dimensions (`accuracy`, `terminology`, `grammar`, `fluency`, `taskStyle`) and aggregated into a scaled final score.
- **Mandatory Practice Disclaimer**: Every score and summary is explicitly labeled as an automated practice estimate. No official endorsement, certification, or affiliation with CIPG (中国外文局), ATICICG (翻译院), CPTA (人事考试网), or any MTI university is implied.
- **Copyright Integrity**: All passages are original compositions authored for this platform; no copyrighted past exam papers are reproduced.

Arabic source and answer fields set `dir="rtl"`; all supported scripts use touch-sized controls and responsive layouts for narrow phones and laptops. The app uses system fonts and local SVG icons, with no remote font or image dependency.


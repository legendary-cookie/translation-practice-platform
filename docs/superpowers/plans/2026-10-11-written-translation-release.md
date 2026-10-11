# Translation Practice Platform — Written Translation Release Implementation Plan

> **For agentic workers:** Use the executing-plans workflow to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first usable local-first release of the CATTI/MTI practice app, with written and news translation, structured AI feedback, local history, and laptop/phone layouts.

**Architecture:** Build a responsive React PWA. Keep exercise/session data in IndexedDB, cache the app shell with a service worker, and route evaluation through a provider interface that prefers an on-device WebLLM model and only uses a configured cloud endpoint after per-task consent. The first release makes written/news translation complete; interpreting, exam simulation, and personalized drill generation remain in the product roadmap described in the spec.

**Tech Stack:** Vite, React, TypeScript, `idb` for IndexedDB, `@mlc-ai/web-llm` pinned to 0.2.82, Qwen3 1.7B MLC model for local evaluation, native service-worker APIs, and CSS without remote font or image dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-translation-practice-platform-design.md`

## Global Constraints

- The first audience is individual CATTI/MTI candidates studying independently.
- The initial language set is Chinese, English, Russian, French, Hindi, Spanish, and Arabic.
- Exam-focused translation directions are Chinese to and from each of the other six languages (12 directed pairs).
- A learner can start without an account; practice records, preferences, and progress remain in the local app store on that device.
- Local-only mode sends no practice content to a remote AI service.
- Before any task is sent to a cloud service, show what will be sent and request explicit, task-specific consent. Never switch to cloud silently.
- News exercises may include only original, public-domain, licensed, or otherwise authorized source material.
- AI scores are practice estimates, never official CATTI/MTI results.
- Core screens must remain usable on narrow phone and laptop widths, including right-to-left Arabic display.
- Cross-device sync, teacher/classroom features, payment, and social features are out of scope.
- Do not add or run automated tests in this pass; produce a production build as the packaging step.

## Files and Responsibilities

- `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig*.json`: app toolchain and PWA build.
- `src/main.tsx`, `src/App.tsx`, `src/styles.css`: responsive shell, navigation, theme, and route state.
- `src/domain/languages.ts`, `src/domain/types.ts`, `src/domain/scoring.ts`: language catalog, exercise/session/feedback contracts, and feedback validation.
- `src/data/exercises.ts`: original short exercise items for each source language and both written/news practice.
- `src/storage/database.ts`: versioned IndexedDB storage for settings and completed sessions.
- `src/ai/evaluation-prompt.ts`, `src/ai/local-provider.ts`, `src/ai/cloud-provider.ts`, `src/ai/provider.ts`, `src/ai/local-worker.ts`: provider boundary, local model worker, opt-in cloud call, prompt, and response parsing.
- `src/features/dashboard/`: home summary and mode navigation.
- `src/features/practice/`: setup, translation workspace, timer, and feedback display.
- `src/features/progress/`: local history and skill summaries.
- `src/features/settings/`: inference mode, model preparation, cloud endpoint form, export, and deletion.
- `public/manifest.webmanifest`, `public/sw.js`, `public/icons/`: install metadata, offline app shell, and local icons.
- `README.md`: setup, local AI model download, privacy behavior, and known device limitations.

## Tasks

### Task 1: Create the responsive PWA foundation

**Files:**
- Create: toolchain files listed above.
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`.
- Create: `public/manifest.webmanifest`, `public/sw.js`, and app icons.

**Interfaces:**
- `App` owns the current top-level page (`home`, `practice`, `progress`, or `settings`) and passes page-change callbacks to the navigation and feature panels.
- The app shell exposes written translation and news translation as available modes; interpreting and exam simulation appear as planned modes with their scope clearly labeled.

- [x] Scaffold Vite React TypeScript without overwriting `docs/` or `.git/`.
- [x] Add a left navigation rail on desktop and a compact touch navigation on phones.
- [x] Implement a consistent visual system with system fonts and local SVG/CSS icons only.
- [x] Add the PWA manifest and a versioned service worker cache for the app shell.
- [x] Add `dev`, `build`, and `preview` scripts; run `npm run build` after the foundation is in place.
- [x] Commit the foundation as `feat: scaffold responsive local-first app`.

### Task 2: Define language, exercise, feedback, and local-storage contracts

**Files:**
- Create: `src/domain/languages.ts`, `src/domain/types.ts`, `src/domain/scoring.ts`.
- Create: `src/data/exercises.ts`.
- Create: `src/storage/database.ts`.

**Interfaces:**
- `LanguageCode` is the union `"zh" | "en" | "ru" | "fr" | "hi" | "es" | "ar"`.
- `Exercise` contains `id`, `mode`, `sourceLanguage`, `targetLanguage`, `title`, `topic`, `difficulty`, `sourceText`, and `glossary`.
- `EvaluationInput` contains the exercise, learner answer, and mode.
- `TranslationFeedback` contains `summary`, five 0–100 dimension scores, `strengths`, `issues`, and `uncertainty`.
- `SessionRecord` contains `id`, `createdAt`, exercise id, language direction, answer, feedback, and elapsed time.
- `evaluationProvider.evaluate(input)` returns `Promise<TranslationFeedback>`; all provider results pass through `validateFeedback` before storage or display.
- `database` exposes `listSessions()`, `saveSession(session)`, `getSettings()`, `saveSettings(settings)`, `exportData()`, and `clearData()`.

- [x] Add the seven language labels, script direction metadata, and the 12 Chinese-centered directions.
- [x] Add seven short original practice passages, one authored in each source language, with news-style and general translation tags.
- [x] Add IndexedDB stores for settings and sessions; keep secrets out of this database.
- [x] Implement feedback normalization: clamp each dimension score to 0–100, reject missing required fields, and discard annotations whose quoted evidence does not occur in the source or answer.
- [x] Run `npm run build` and commit as `feat: add local practice data model`.

### Task 3: Implement local and consent-based cloud evaluation providers

**Files:**
- Create: `src/ai/provider.ts`, `src/ai/evaluation-prompt.ts`, `src/ai/local-provider.ts`, `src/ai/cloud-provider.ts`, `src/ai/local-worker.ts`.
- Modify: `src/domain/types.ts`, `src/domain/scoring.ts`, `src/features/settings/`.

**Interfaces:**
- `EvaluationProvider.evaluate(input)` uses the same contract for local and cloud providers.
- `createLocalProvider(modelId, onProgress)` loads `Qwen3-1.7B-q4f16_1-MLC` through WebLLM in a web worker and returns an evaluator.
- `createCloudProvider(config)` accepts `{ baseUrl, model, apiKey }`, sends an OpenAI-compatible chat-completion request, and never persists `apiKey`.
- The router uses local evaluation when selected and ready. If cloud is enabled and local evaluation is unavailable, it returns a `needs-consent` result containing the exact exercise text and answer; only an explicit confirmation may call the cloud provider.

- [x] Pin `@mlc-ai/web-llm` to version `0.2.82` and use its web-worker API so generation does not block the UI.
- [x] Add explicit model preparation, download progress, cached/ready state, and recoverable error handling.
- [x] Request a JSON-shaped rubric response without treating model output as calibrated or official scoring.
- [x] Add a cloud settings form for an OpenAI-compatible URL, model, and session-only key; require a per-session consent dialog before sending exercise text or a learner answer.
- [x] Make the local-only setting disable all evaluation network requests, including when local model support is unavailable.
- [x] Run `npm run build` and commit as `feat: add privacy-aware AI evaluation providers`.

### Task 4: Build the written and news translation learning loop

**Files:**
- Create: `src/features/dashboard/Dashboard.tsx`.
- Create: `src/features/practice/PracticeSetup.tsx`, `TranslationWorkspace.tsx`, `FeedbackPanel.tsx`, `practice.css`.
- Modify: `src/App.tsx`, `src/styles.css`.

**Interfaces:**
- `PracticeSetup` selects mode, direction, topic, difficulty, and timing, and emits an `Exercise` plus timing configuration.
- `TranslationWorkspace` owns the draft answer and elapsed time, then calls the evaluation router on submit.
- `FeedbackPanel` renders validated rubric scores, exact evidence quotes, explanations, alternatives, uncertainty, and a revise action.
- A completed session is saved through `database.saveSession` only after feedback has passed validation.

- [x] Add dashboard cards for continue practice, written translation, news translation, local AI status, and recent skill activity.
- [x] Add an accessible source/answer workspace with a glossary, word count, timer, and submit/revise flow.
- [x] Support the 12 initial directions and correct left-to-right/right-to-left text rendering.
- [x] Display an explicit practice-estimate label and explain when a task cannot be evaluated locally.
- [x] Run `npm run build` and commit as `feat: add translation practice and feedback`.

### Task 5: Add progress, privacy controls, export, and deletion

**Files:**
- Create: `src/features/progress/ProgressPage.tsx`, `src/features/progress/progress.css`.
- Create: `src/features/settings/SettingsPage.tsx`, `src/features/settings/settings.css`.
- Modify: `src/App.tsx`, `src/storage/database.ts`, `src/styles.css`.

**Interfaces:**
- Progress summaries derive only from locally stored session records.
- `database.exportData()` returns a versioned JSON object containing learner settings and session history, excluding transient API keys.
- `database.clearData()` removes local sessions and settings after an explicit confirmation.

- [x] Show sessions, score trends, and dimension averages without inventing data for a new learner.
- [x] Add export to a user-selected JSON download and confirmed local-data deletion.
- [x] Add privacy mode selection, model status, cloud endpoint fields, transient API-key entry, and per-task consent copy.
- [x] Show clearly that data is stored per browser/device and is not synchronized.
- [x] Run `npm run build` and commit as `feat: add learner progress and privacy settings`.

### Task 6: Finish responsive details and project handoff

**Files:**
- Modify: `src/styles.css`, feature CSS files, PWA assets, and `README.md`.

- [x] Refine keyboard focus, labels, contrast, touch target size, reduced-motion handling, Arabic direction, and narrow-screen layouts.
- [x] Ensure the service worker caches same-origin app assets only; never cache evaluation requests or cloud responses.
- [x] Document setup, `npm run dev`, `npm run build`, first-time local-model download, cloud opt-in, offline boundaries, and current planned modes.
- [x] Produce the final production build with `npm run build` and commit as `docs: document local-first practice app`.

## Research Notes

- Vite's official guide currently documents the React TypeScript template and requires Node.js 20.19+ or 22.12+; the available Node runtime is 26.8.1: <https://vite.dev/guide/>.
- WebLLM documents in-browser WebGPU inference, worker support, and supported-model registration: <https://github.com/mlc-ai/web-llm>.
- Qwen's official Qwen3 announcement lists Chinese, English, Russian, French, Hindi, Spanish, and Arabic among its supported languages: <https://qwenlm.github.io/blog/qwen3/>.
- WebLLM `0.2.82` remains pinned as a precaution because an open issue reports a `0.2.83`/`0.2.84` regression on longer prompts on an integrated GPU, with `0.2.82` reported unaffected: <https://github.com/mlc-ai/web-llm/issues/844>. On 2026-10-12, the local Chrome context reported WebGPU available, L2 desktop capability, a 32 GiB coarse device-memory signal, and 10.0 GiB estimated origin headroom. `0.2.86` downloaded the Qwen3 model, populated the cache, and reached worker-ready state, but both a 1,008-word / 5,163-character prompt and a 58-word / 270-raw-character control failed. This does not isolate a `0.2.86` regression. Re-running pinned `0.2.82` in the same browser/hardware also reached worker-ready state, but an equivalent 58-word / 270-raw-character control remained `Evaluating…` for 2m15s without returning. No working local inference run was obtained, so the version comparison is inconclusive: `0.2.86` is unvalidated, not refuted. Change the pin only after a controlled 0.2.82-versus-0.2.86 comparison has a passing control on target hardware.
- IndexedDB and service workers support browser-local structured storage and offline app-shell behavior: <https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB> and <https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers>.

## Handoff Notes

- This first release does not implement interpreting, exam simulation, or generated personalized drills; those remain in the accepted product spec and need their own implementation slices.
- The cloud adapter is a user-configured OpenAI-compatible endpoint. No provider, key, account, or subscription is preselected.
- A first-time local model download requires network access; after its model assets are cached, local inference can operate without sending practice content remotely.

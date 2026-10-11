# Translation Studio

A browser-based written and news translation practice app. No account or server database is required. Saved sessions and preferences stay in IndexedDB for the current browser profile and origin; there is no device sync. Drafts and unsaved feedback live only in the open page and disappear on reload or close.

## Run locally

Use Node.js 20.19+ or 22.12+ and npm (the handoff build used Node 26.8.1).

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. The dev command listens on all interfaces; use localhost for a secure context, or HTTPS when serving another device. WebGPU and service workers require a secure context. Development does not register the app service worker.

```sh
npm run build
npm run preview
```

Build runs TypeScript compilation and Vite bundling into `dist/`. Preview serves that production output for local review; use an HTTPS static host for deployment. Serve this release at the origin root: manifest, icons and service worker use absolute paths. Install the PWA through the browser's install action when supported. Installation and WebGPU availability vary by browser/device. There is no dedicated test script in this release.

## Practice available now

Written translation and news-register practice support seven languages: Chinese, English, Russian, French, Hindi, Spanish and Arabic. The 12 directions are Chinese to/from each of the six other languages. Arabic passages, answers and evidence use right-to-left language metadata.

The catalog contains seven short original fictional passages, one per source language, reused in the two modes (14 exercise entries). These are intermediate sample exercises, not current reporting, licensed exam papers, a graded course or a broad difficulty catalog. Mode, direction and sample passage filters expose only available catalog entries. A timer is a practice target; reaching it does not force submission.

Feedback offers five dimension scores, strengths, quoted evidence, revision ideas and uncertainty. Scores are uncalibrated AI practice estimates, not official CATTI/MTI results or measured language ability. Invalid or incomplete feedback is rejected; manual review remains available. Save a completed assessment explicitly to include it in local history. Revisions can create additional assessments, so mixed-task progress averages should be interpreted cautiously.

## Local AI and network use

Privacy defaults to **Local only**. In Privacy & data, **Download / prepare local model** explicitly permits downloading large model/runtime assets from MLC/Hugging Face, even in local-only mode. The pinned optional model is `Qwen3-1.7B-q4f16_1-MLC`, via WebLLM 0.2.82. It requires WebGPU, `shader-f16`, a secure context, sufficient GPU memory (approximately 2 GB is the model's stated requirement) and browser storage capacity. Download/load time and support depend on the device; no device benchmark or multilingual quality validation has been performed.

First preparation needs a network connection. Cached weights alone do not confirm that tokenizer, configuration and runtime assets are cached. Browser eviction, missing assets or unavailable GPU features can prevent later preparation. Submission only uses an already-ready model and never starts preparation/download. A failed local assessment offers manual review, or a separately consented cloud option when configured. The 4,096-token local context has a conservative combined 4,000-character source/answer guard; that guard does not guarantee every script fits. The editor permits up to 6,000 characters, so some drafts exceed the local evaluator's limit.

Local inference is designed to keep practice text on the device. Successful local inference, offline inference, performance and assessment quality remain unverified in the build-only handoff. Do not rely on network-free inference until it has been checked on the target browser with all required assets present.

## Optional cloud feedback

Choose **Local first, optional cloud**, enter an OpenAI-compatible base URL and model, enter a session API key, and save preferences. No provider, account, key, model or subscription is preselected. The base URL must use HTTPS, or HTTP on localhost, and ends before `/chat/completions`. The provider must support browser CORS and JSON output mode. Compatibility with an actual provider remains unverified.

A ready local model is preferred. Before any cloud assessment, the dialog previews the exact source passage, submitted answer, language/style metadata, tutor rubric, destination and complete request body. **Send this answer** authorizes that request once. Cancellation, changes to the key/settings/draft and retries require fresh approval. The API key is sent in the authorization header, held only in page memory, excluded from IndexedDB/history/exports, and cleared by reload, key clearing or local-data deletion. Provider URL/model preferences are persisted. A provider may retain received text under its own policy; consent cancellation or deletion cannot recall an already-dispatched request.

## Offline shell and caches

The production service worker precaches the root HTML, manifest, listed icons and HTML-referenced fingerprinted JavaScript/CSS. It caches other matching same-origin build bundles when requested. It excludes non-GET requests, query URLs, cross-origin requests, APIs, evaluation/cloud responses and model downloads. WebLLM manages its own asset caches separately.

An offline revisit can use the installed shell after a successful online production visit and service worker installation. Lazy build bundles are only available offline once fetched; installation does not preload every AI bundle. Offline shell availability does not establish offline AI availability. Service worker install/update, cache eviction and offline inference have not been exercised in this handoff. A newly waiting worker normally activates after pages using the old worker close; revisit online to receive a new build.

WebLLM is loaded separately on preparation. Its runtime and worker bundles are approximately 6 MB each before compression and produce Vite's default 500 kB chunk warning. This affects download and startup cost; the warning threshold has not been changed to suppress it.

## Local data, export and deletion

Progress summarizes explicitly saved assessments and lets you inspect saved answers and feedback. **Download data as JSON** requests a browser-managed export containing preferences, saved learner text and feedback. It excludes keys, active drafts, pending consent and model caches. The browser controls where/if the file is saved; there is no import/restore feature.

**Delete local practice data** asks for confirmation before clearing saved history/preferences, current drafts/unsaved feedback, session key and pending consent, and releasing model memory in this page. It waits for evaluation and saves in this app instance to finish. Deletion cannot be undone. It does not remove separately downloaded WebLLM assets, installed shell caches, downloaded JSON copies or provider-retained text. Use browser site-data/cache controls to remove retained browser assets; this also removes local history, and assets must be downloaded again.

Other tabs/windows are not coordinated or locked. They can retain stale preferences, keys or in-memory drafts and can write records after another tab deletes data. Close other app tabs before deleting data, and reload them before continuing. Storage denial, quota limits, eviction or browser-profile removal can make local data unavailable; retain exports for records you want to keep.

## Planned work and handoff evidence

Interpreting, exam simulation and generated personalized drills remain planned. Audio, exam grading, synced accounts and drill recommendations are not implemented.

The handoff production build checks compilation and packaging only. No new tests, browser/keyboard/assistive technology run, responsive visual review, local model download/inference, cloud request, storage operation or PWA/offline runtime check was performed. Responsive grids, labeled native controls, focus outlines, touch targets, reduced-motion rules and Arabic direction support are implemented but require runtime review before claiming accessibility or device support.

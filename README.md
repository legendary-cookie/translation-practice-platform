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

The app detects a runtime capability tier before offering local evaluation. Devices without WebGPU or enough storage are L0 and unavailable; iOS, Android, and devices without a strong memory signal remain restricted at L1 until real-device validation proves the model safe and useful; supported desktop-class devices can reach L2 after preflight. Hindi and Arabic directions remain manual-review or explicit-cloud-consent tasks because Qwen3's listed language support does not establish useful 1.7B critique quality. If a previously prepared model disappears from browser storage, Settings reports the missing cache instead of silently falling back.

On 2026-10-12, WebLLM `0.2.86` was exercised in local Chrome: model download, cache detection, and worker preparation succeeded, but both a 1,008-word / 5,163-character prompt and a 58-word / 270-character control evaluation failed. The exact `0.2.82` pin therefore remains until the failure is reproducible and fixed; the reported `0.2.83`/`0.2.84` long-prompt regression is not considered cleared by a changelog claim alone: <https://github.com/mlc-ai/web-llm/issues/844>.

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

## Included and planned modes

Written translation and news translation are available now, using original source passages authored for this app. Interpreting, exam simulation, generated personalized drills, sync, accounts, payments, and classroom features are planned modes outside this release.

Arabic source and answer fields set `dir="rtl"`; all supported scripts use touch-sized controls and responsive layouts for narrow phones and laptops. The app uses system fonts and local SVG icons, with no remote font or image dependency.

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

On 2026-10-12, standalone external Chrome reported WebGPU available, an L2 desktop capability, a 32 GiB coarse device-memory signal, and 10.0 GiB estimated origin headroom. With the pinned `0.2.82` build, an unconstrained control completed in about 355 ms and a prompt-only JSON control in about 1.03 s after the model was ready. A realistic 91-character Chinese source and 55-word English answer completed with visible feedback in 53.4 s on one run and 74.2 s on a clean rerun. A later warm-cache run completed in 24.8 s. This spread is material: these are measurements on one strong desktop, not a latency promise; phone viability remains unproven.

The local evaluator uses streamed, prompt-only JSON rather than WebLLM `response_format: { type: "json_object" }`: on this pinned build the constrained request reached stream initialization but stalled before its first token, while prompt-only generation streamed normally. The response is parsed as one complete JSON document and validated before any score is displayed or saved. A malformed, semantically invalid, or `finish_reason: "length"` response gets one bounded deterministic retry; if that also fails, the learner sees an explicit no-score error and can review manually or choose the existing per-task cloud-consent path. The output cap is 1,400 tokens, above the observed rubric response, but longer inputs can still exceed the model's context budget.

Qwen3 non-thinking mode is sent explicitly on every local request as WebLLM's `extra_body.enable_thinking: false`. WebLLM exposes that field in the chat-completion generation configuration and maps it from `request.extra_body`; Qwen's model card says `enable_thinking=False` disables reasoning. This pinned runtime still emitted an empty `<think>` wrapper in the observed response, so the parser removes that wrapper defensively. See the [WebLLM API reference](https://github.com/mlc-ai/web-llm/blob/main/docs/user/api_reference.rst), [WebLLM engine mapping](https://github.com/mlc-ai/web-llm/blob/main/src/engine.ts), and [Qwen3 model card](https://huggingface.co/Qwen/Qwen3-8B#switching-between-thinking-and-non-thinking-mode), all checked 2026-10-12.

The model reached ready state and produced results only in standalone external Chrome during this investigation. AO's Electron-based preview stalled during WebLLM reload/model initialization before engine-ready, so that preview is not evidence that the local path works or fails in a supported browser. The `0.2.86` upgrade remains unvalidated, not refuted; `0.2.82` stays pinned. The earlier `0.2.83`/`0.2.84` long-prompt regression still requires a controlled comparison: <https://github.com/mlc-ai/web-llm/issues/844> (checked 2026-10-12).

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

# Translation Practice Platform — Audio Interpreting Slice Implementation Plan

> **For agentic workers:** Use the executing-plans workflow to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the second local-first practice loop for rights-cleared audio interpreting, with offline playback, consecutive and simultaneous recording, transcript-aligned feedback, and explicit confidence and privacy boundaries.

**Architecture:** Extend the phase 1 React PWA, IndexedDB schema, domain contracts, and evaluation-provider router instead of replacing them. Package short, rights-cleared source clips as same-origin PWA assets, describe their timestamped transcript segments in the local catalog, and keep learner recordings in a versioned local audio store. Use `getUserMedia` and `MediaRecorder` for recording, Web Audio for local delivery heuristics, and Web Speech only when its experimental on-device capability is verified for the selected target language; otherwise use an editable manual transcript and clearly degraded feedback. Local WebLLM receives transcript and derived metrics only, while the cloud adapter receives audio only after a task-specific consent screen shows the exact payload.

**Tech Stack:** Existing Vite, React, TypeScript, `idb`, WebLLM worker, and service worker; native `MediaDevices.getUserMedia`, `MediaRecorder`, `HTMLAudioElement`, Web Audio `AudioContext`/`AnalyserNode`, and capability-gated Web Speech `SpeechRecognition` with `processLocally: true`. No new runtime dependency is required for the browser audio path.

**Spec:** `docs/superpowers/specs/2026-10-11-translation-practice-platform-design.md`

## Global Constraints

- Extend the completed phase 1 PWA, `src/domain/{languages,types,scoring}.ts`, `src/storage/database.ts`, and `src/ai/` provider boundary; preserve written and news translation behavior.
- The initial language set remains Chinese, English, Russian, French, Hindi, Spanish, and Arabic, with the 12 Chinese-centered directions.
- A learner can start without an account; source assets, recordings, transcripts, feedback, settings, and progress remain on the current browser/device by default.
- Ship only original, public-domain, licensed, or otherwise clearly authorized audio. Every packaged clip must have a matching rights record and content hash before it is referenced by an exercise.
- The service worker may cache same-origin app assets and packaged audio only. It must never cache microphone uploads, evaluation requests, cloud responses, or remote audio.
- Local-only mode sends zero learner audio, source transcript, learner transcript, or derived practice payload to a remote AI or speech-recognition service. Do not invoke default remote Web Speech recognition; only use a capability-verified local path with `processLocally: true`.
- On-device recognition is optional and runtime-gated by browser support, language-pack availability, and `dictation` capability. The current published local-browser support evidence covers only a subset of languages; do not claim automatic recognition for Chinese, Russian, French, Hindi, or Arabic without a verified runtime result.
- When recognition is unavailable or low-confidence, keep the audio practice usable through manual transcript entry and local audio-only delivery feedback. Never turn an uncertain recognition token into a learner omission, mistranslation, or addition.
- Before cloud evaluation, request explicit consent for that task and show the provider URL/model plus the exact source transcript, learner transcript, learner-audio format/duration/size, and derived metrics that will be sent. Never switch to cloud silently; an audio-capable cloud payload that cannot be represented in the consent preview is unavailable.
- Meaning transfer, omissions, additions/mistranslations, and terminology are content measures. Fluency, pacing, and hesitation are delivery measures and must be displayed and validated as a separate group.
- All scores are practice estimates, never official CATTI/MTI results. Any score based on incomplete or uncertain evidence must say so instead of presenting false precision.
- Microphone capture requires a secure context and user permission. Recording controls must release tracks after stop, support keyboard access, and remain touch-friendly on phone and laptop layouts.
- Do not add automated test dependencies or test files in this pass; use the production build and the manual browser/device smoke matrix described in Task 6 as the packaging gate.
- Cross-device sync, accounts, teacher/classroom features, payment, social features, and exam simulation remain out of scope.

## Files and Responsibilities

**Modify existing files:**

- `src/domain/languages.ts`: add BCP 47 speech tags and preserve the existing language/direction catalog.
- `src/domain/types.ts`: extend practice, audio exercise, recording, alignment, confidence, evaluation-input, feedback, session, and export contracts without removing written/news shapes.
- `src/domain/scoring.ts`: validate interpreting content and delivery groups, segment evidence, confidence metadata, and uncertainty separately from `validateFeedback`.
- `src/storage/database.ts`: upgrade IndexedDB without clearing phase 1 data; add a recordings store, recording/session references, export coverage, and deletion of audio records.
- `src/ai/provider.ts`, `src/ai/evaluation-prompt.ts`, `src/ai/local-provider.ts`, `src/ai/cloud-provider.ts`: accept the interpreting input union, route local transcript/metric evaluation, and add an explicit audio-bearing cloud payload without weakening the existing consent boundary.
- `src/App.tsx`: route interpreting setup/workspace/feedback, save audio-backed sessions, and render the generalized consent dialog.
- `src/features/dashboard/Dashboard.tsx`, `src/features/practice/PracticeSetup.tsx`: expose the interpreting mode while keeping written/news setup intact.
- `src/features/progress/ProgressPage.tsx`, `src/features/settings/SettingsPage.tsx`: narrow session unions, show separate interpreting score groups and recognition capability, and preserve local deletion/privacy behavior.
- `src/styles.css`, `public/sw.js`, `README.md`: share responsive controls, version the offline audio cache, and document audio rights, browser limits, offline behavior, and cloud disclosure.

**Create new files and assets:**

- `src/data/interpreting-exercises.ts`: local catalog entries for the 12 directions, source clip URLs, segment timestamps/transcripts, glossary, difficulty, and rights-record IDs.
- `src/audio/audio-player.ts`: segment-aware source playback, seek, repeat, and cleanup wrapper around `HTMLAudioElement`.
- `src/audio/audio-recorder.ts`: permission, MIME negotiation, recording, replay URL, and track lifecycle wrapper around `getUserMedia`/`MediaRecorder`.
- `src/audio/audio-analysis.ts`: local Web Audio envelope/pause analysis and signal-quality confidence; no network calls.
- `src/audio/local-speech-recognition.ts`: feature detection and on-device-only `SpeechRecognition` adapter with language-pack status and recognition confidence.
- `src/features/interpreting/InterpretingSetup.tsx`, `InterpretingWorkspace.tsx`, `TranscriptAlignment.tsx`, `InterpretingFeedbackPanel.tsx`, `interpreting.css`: setup, transport/recording workspace, aligned evidence, feedback, and responsive styling.
- `public/audio/interpreting/`: short source clips for the catalog, packaged as same-origin assets with no remote URL dependency.
- `public/audio/interpreting/rights.json`: provenance, authorization/license, speaker permission, MIME type, duration, and SHA-256 record for each packaged asset.

No `package.json` or `package-lock.json` change is planned; the initial implementation uses browser APIs already available to the phase 1 toolchain.

## Tasks

### Task 1: Extend interpreting contracts, storage, and provider privacy boundaries

**Files:**
- Modify: `src/domain/languages.ts`, `src/domain/types.ts`, `src/domain/scoring.ts`.
- Modify: `src/storage/database.ts`.
- Modify: `src/ai/provider.ts`, `src/ai/evaluation-prompt.ts`, `src/ai/local-provider.ts`, `src/ai/cloud-provider.ts`.

**Interfaces:**
- Preserve the existing written/news `Exercise`, `EvaluationInput`, `TranslationFeedback`, and `SessionRecord` shapes; add an `InterpretingExercise` discriminated by `mode: 'interpreting'`.
- `AudioSegment` contains `id`, `startMs`, `endMs`, and the authored source `transcript`; segment ranges are validated as ordered, non-overlapping, and within `durationMs`.
- `InterpretingExercise` contains `id`, `mode`, `sourceLanguage`, `targetLanguage`, `title`, `topic`, `difficulty`, `audioUrl`, `audioMimeType`, `durationMs`, `segments`, `glossary`, `tags`, and `rightsRecordId`.
- `AudioRecordingRecord` contains `id`, `exerciseId`, `segmentIds`, `createdAt`, `mimeType`, `durationMs`, `byteLength`, and the recorded `Blob`; the blob is local evidence, not a network permission.
- `InterpretingResponseSegment` contains `id`, `sourceSegmentId`, `recordingId`, `responseStartMs`, `responseEndMs`, `transcript`, `transcriptSource` (`manual` or `on-device`), `recognitionStatus`, and optional `recognitionConfidence`.
- `DeliveryAnalysis` contains `durationMs`, `activeSpeechRatio`, `pauseCount`, `longestPauseMs`, optional `wordsPerMinute`, `signalQuality`, `analysisConfidence`, and the method/version used to derive the values.
- `InterpretingEvaluationInput` contains the exercise, `interpretingMode` (`consecutive` or `simultaneous`), response segments, local recording records, and delivery analysis. Local providers receive the same object but build prompts from transcripts and derived metrics only.
- `InterpretingFeedback` contains separate `contentScores` (`meaningTransfer`, `omissions`, `additionsMistranslations`, `terminology`) and `deliveryScores` (`fluency`, `pacing`, `hesitation`), an optional `overallScore`, `strengths`, verified `issues`, `uncertainEvidence`, `alternatives`, `uncertainty`, and aggregate recognition/audio-analysis confidence. An omission score is completeness, so a higher score means fewer consequential omissions.
- `InterpretingAnnotation` contains `category`, `sourceSegmentId`, optional `responseSegmentId`, source/learner quotes, explanation, suggestion, `evidenceStatus`, and the recognition/audio confidence values used. Only `evidenceStatus: 'verified'` can affect a score; uncertain evidence is rendered under `uncertainEvidence` instead.
- `EvaluationProvider.evaluate` returns the written or interpreting feedback union. `EvaluationResult` continues to distinguish `evaluated`, `needs-consent`, and `unavailable`.
- `CloudConsentRequest` retains the written `sourceText`/`learnerAnswer` fields and adds a structured `payloadPreview` containing exact text parts, provider URL/model, a learner-audio part with MIME/duration/byte length and a playable local preview, and delivery metrics. Its `confirm` callback is the only path that may call the audio-capable cloud provider.
- `database` adds `saveAudioRecording`, `getAudioRecording`, `deleteAudioRecording`, and a version-2 `exportData`; `clearData` removes recordings as well as phase 1 settings/sessions.

- [ ] Extend `PracticeMode`, evaluation-input, feedback, session, and export unions without changing the existing written/news JSON field names.
- [ ] Add BCP 47 tags for the seven catalog languages and use them only as runtime recognition candidates; do not encode browser support as a static promise.
- [ ] Add content/delivery score types, alignment evidence status, recognition confidence, signal-quality confidence, and uncertainty fields.
- [ ] Implement `validateInterpretingFeedback` so source/learner quotes must occur in the referenced segment, segment IDs must exist, score values are clamped to 0–100, and low-confidence evidence is excluded from learner-error annotations and content-score calculations.
- [ ] Upgrade IndexedDB from version 1 to version 2 without deleting existing stores; add a recordings object store and keep audio blobs referenced by session ID/recording ID.
- [ ] Extend export to include recording metadata and browser-safe audio data for short clips, exclude transient API keys, and make deletion remove every recording blob.
- [ ] Extend the evaluation router and prompt builders so local interpreting evaluation sees source/learner transcripts plus derived metrics but never dispatches audio; local-only mode returns an unavailable result instead of constructing a cloud request.
- [ ] Add an audio-bearing OpenAI-compatible request shape in the cloud provider, reject endpoints that cannot accept it, and preserve per-task consent before any request is constructed or sent.
- [ ] Run `npm run build` and commit as `feat: add interpreting domain and privacy contracts`.

### Task 2: Package rights-cleared audio and offline exercise assets

**Files:**
- Create: `src/data/interpreting-exercises.ts`.
- Create: `public/audio/interpreting/` source clips and `public/audio/interpreting/rights.json`.
- Modify: `public/sw.js`.

**Interfaces:**
- `interpretingExercises` is a typed `InterpretingExercise[]` with at least one short source clip for each of the seven initial source languages and one catalog entry for each Chinese-centered direction; the same source clip may serve both target directions only when its transcript and segment IDs remain identical.
- `getInterpretingExercisesForDirection(sourceLanguage, targetLanguage)` returns only local catalog entries whose asset and rights record are present.
- `rights.json` maps each `rightsRecordId` to `assetPath`, `sha256`, `mimeType`, `durationMs`, `origin`, `licenseOrPermission`, `speakerPermission`, and `allowedUse`.
- `public/sw.js` increments its cache version and pre-caches the catalog, rights record, and every packaged audio URL as same-origin app assets.

- [ ] Author short, exam-relevant practice scripts and record or source only audio for which the project has original, public-domain, licensed, or written authorization; do not copy a broadcast, podcast, course, or news clip without rights evidence.
- [ ] Split each clip into timestamped practice segments in the catalog while retaining a single source asset for efficient offline caching; reject zero-length, overlapping, or out-of-bounds ranges at catalog validation time.
- [ ] Record the exact asset hash, duration, MIME type, provenance, speaker permission, and allowed use in `rights.json`; fail the catalog build or exercise lookup when a rights record is missing.
- [ ] Use same-origin packaged URLs only. Do not add CDN audio, runtime download URLs, remote transcript URLs, or service-worker routes that proxy audio.
- [ ] Add every audio asset and its metadata to the versioned service-worker precache, and make the setup screen report whether the selected asset is available offline before recording begins.
- [ ] Keep audio clips short enough for phone storage and consent previews, and show the exact duration/size to the learner before a recording is saved or sent to cloud evaluation.
- [ ] Run `npm run build` and commit as `feat: package offline interpreting exercises`.

### Task 3: Implement local playback, recording, analysis, and recognition capability checks

**Files:**
- Create: `src/audio/audio-player.ts`, `src/audio/audio-recorder.ts`, `src/audio/audio-analysis.ts`, `src/audio/local-speech-recognition.ts`.

**Interfaces:**
- `createAudioPlayer(exercise)` returns segment-aware `playSegment(segmentId)`, `pause()`, `seek(seconds)`, `setRepeat(enabled)`, `getCurrentTime()`, and `dispose()` methods. Segment playback pauses at `endMs` and never loops outside the selected segment.
- `createResponseRecorder()` returns `requestPermission()`, `start(segmentId, mode)`, `pause()`, `resume()`, `stop()`, `getReplayUrl(recording)`, and `dispose()`; `stop()` returns an `AudioRecordingRecord` after the final `dataavailable` event and stops every microphone track.
- `analyzeRecording(blob)` returns `DeliveryAnalysis` using a local `AudioContext`, `createMediaStreamSource`/decoded audio, and `AnalyserNode` time-domain energy windows; it never uploads the blob.
- `getLocalRecognitionCapability(languageTag)` returns `available`, `downloadable`, `downloading`, or `unavailable` with a user-facing reason. `recognizeLocal(track, languageTag, segmentId)` returns transcript text, final/interim status, alternatives where available, and the numeric recognizer confidence.

- [ ] Request `navigator.mediaDevices.getUserMedia({ audio: true })` only from an explicit record action, show secure-context/permission/device errors, and release tracks on stop, cancel, navigation, and unmount.
- [ ] Select the first runtime-supported `MediaRecorder` MIME type by checking `MediaRecorder.isTypeSupported()` (prefer `audio/webm;codecs=opus`, then `audio/ogg;codecs=opus`, then `audio/mp4`), and use the browser default only when construction succeeds without a requested type.
- [ ] Collect `dataavailable` chunks, create a Blob with the recorder's actual MIME type, expose a local object URL for replay, and revoke object URLs when a take is replaced or disposed.
- [ ] Feed the live stream into Web Audio for a waveform/level indicator and coarse active-speech/pause windows; label these as heuristic delivery measures rather than pronunciation or meaning judgments.
- [ ] Give consecutive recordings the selected source segment ID and response timing; give simultaneous recordings a continuous timeline plus source-segment boundary markers so later alignment remains segment-level and honest about timing precision.
- [ ] Feature-detect unprefixed and prefixed `SpeechRecognition`, then require `processLocally: true` and `SpeechRecognition.available({ langs: [tag], quality: 'dictation', processLocally: true })` before starting. Install a language pack only through an explicit user action and explain that a model-pack download contains no learner audio or transcript.
- [ ] Never call `start()` with the default remote mode in local-only mode. When local recognition is unavailable, return a capability result that activates manual transcript entry rather than falling back to a server.
- [ ] Pass a live audio track to `SpeechRecognition.start(track)` only when the browser exposes that overload; otherwise mark recognition unavailable for this take. Preserve the API's reported confidence as a recognizer estimate and never treat it as calibrated learner accuracy.
- [ ] Add a manual transcript editor for every response segment. A learner-confirmed edit is the only path that changes recognition-uncertain text into verified evidence.
- [ ] Run `npm run build` and commit as `feat: add local audio practice primitives`.

### Task 4: Build the interpreting setup and practice workspace

**Files:**
- Create: `src/features/interpreting/InterpretingSetup.tsx`, `src/features/interpreting/InterpretingWorkspace.tsx`, `src/features/interpreting/interpreting.css`.
- Modify: `src/App.tsx`, `src/features/dashboard/Dashboard.tsx`, `src/features/practice/PracticeSetup.tsx`, `src/styles.css`.

**Interfaces:**
- `InterpretingSetup` selects direction, topic, difficulty, exercise, and `interpretingMode`; it displays the selected asset's offline status and the target-language recognition capability before opening the workspace.
- `InterpretingWorkspace` accepts an `InterpretingExercise`, `interpretingMode`, evaluation status, and notice callbacks; it emits a complete `InterpretingEvaluationInput` only after every required response segment has either a recording or an explicit skipped status and every transcript is manual, verified, recognition-uncertain, or unavailable.
- The existing written/news `PracticeSetup` continues to emit its existing selection shape; the new interpreting branch is discriminated before `TranslationWorkspace` is rendered.

- [ ] Add an Audio interpreting mode entry from the dashboard and setup flow without changing the written/news exercise lookup or workspace.
- [ ] Show source title, direction, topic, difficulty, glossary, segment count, duration, offline-ready status, and the recognition limitation for the selected target language.
- [ ] Add touch-sized source transport controls for play/pause, previous/next segment, seek within the segment, repeat current segment, and a visible current-segment indicator. Keep native keyboard and screen-reader labels even when custom controls are shown.
- [ ] Implement consecutive mode as a listen-then-record loop: play one segment, stop at its end, enable recording, save the response against that segment, and allow source repeat and response replay before moving on.
- [ ] Implement simultaneous mode as one synchronized start action for source playback and continuous recording, with pause/stop controls and source-segment boundary markers; never pretend that continuous mode produced word-level alignment.
- [ ] Show a persistent recording state, elapsed time, microphone permission state, input level, stop/save, discard/rerecord, and response replay control. Prevent source playback from masking the learner's recording in consecutive mode.
- [ ] Display the on-device transcript with a confidence badge when available, a clear “recognition may be wrong” label for low confidence, and a per-segment editable manual transcript. Do not present a transcript as learner-authored until it is confirmed or manually entered.
- [ ] Keep draft takes in memory until the learner saves/submits them, then persist blobs through `database.saveAudioRecording`; allow the learner to discard a take before submission.
- [ ] Lay out desktop as source/transport and response/recording columns with a stable segment rail; stack them on phones and keep the transport/recording action row reachable without hover, with minimum 44px touch targets and visible focus states.
- [ ] Run `npm run build` and commit as `feat: add interpreting practice workspace`.

### Task 5: Add transcript-aligned, confidence-aware interpreting feedback

**Files:**
- Create: `src/features/interpreting/TranscriptAlignment.tsx`, `src/features/interpreting/InterpretingFeedbackPanel.tsx`.
- Modify: `src/App.tsx`, `src/features/progress/ProgressPage.tsx`, `src/features/settings/SettingsPage.tsx`.

**Interfaces:**
- `TranscriptAlignment` receives source segments, response segments, recordings, and `InterpretingFeedback`; it renders source transcript, learner transcript, source/response time ranges, and annotation links that seek the corresponding local audio.
- `InterpretingFeedbackPanel` renders content and delivery score groups separately, then shows verified annotations, uncertain recognition/audio evidence, alternatives, confidence notes, and revise/transcript-confirm actions.
- The interpreting session record stores mode, direction, exercise ID, `interpretingMode`, response segment references, recording IDs, delivery analysis, evaluator provider, and `InterpretingFeedback`; existing written session records remain renderable.

- [ ] Align source audio and transcript by authored segment IDs and timestamps; align learner response by recorded segment IDs and response time ranges. Display word-level alignment only when a future recognizer supplies it and the evidence is verified; this slice must not fabricate word timestamps.
- [ ] Make each verified annotation seek the source audio to the source range and the learner replay audio to the response range, with an explicit label when a continuous simultaneous take has approximate rather than exact timing.
- [ ] Prompt the evaluator to judge meaning transfer, omissions, additions/mistranslations, and terminology from aligned transcript evidence, and judge fluency, pacing, and hesitation only from the response transcript/timing and local delivery metrics. Keep the groups separate in JSON and UI.
- [ ] Propagate recognition confidence and audio-analysis confidence into every relevant annotation and the top-level uncertainty message. Treat `SpeechRecognitionAlternative.confidence` as an estimate, not a probability of learner error.
- [ ] Enforce the false-positive guard twice: the validator drops any learner-error annotation whose evidence is recognition-uncertain or audio-insufficient, and the feedback UI labels remaining uncertain evidence as “check the transcript” rather than “you made this error.”
- [ ] When no verified transcript exists for a segment, omit meaning/omission/mistranslation scoring for that segment, retain local replay and any sufficiently confident delivery metrics, and state that the content score is incomplete.
- [ ] Extend the consent dialog to show the exact provider URL/model and payload parts: source segment transcript, learner transcript with source/confidence, learner response audio player plus MIME/duration/bytes, and delivery metrics. State that source audio remains on-device unless explicitly listed as a payload part.
- [ ] Require an explicit confirmation click for every interpreting task. Cancel, local-only mode, missing audio support, and provider errors must leave all audio/transcript content on-device and must not cache the request or response.
- [ ] Save only validated feedback and its local recording references. Show separate interpreting trends in Progress and include recordings in local export/deletion without persisting the session-only API key.
- [ ] Run `npm run build` and commit as `feat: add confidence-aware interpreting feedback`.

### Task 6: Finish responsive details, offline/privacy documentation, and handoff

**Files:**
- Modify: `src/styles.css`, `src/features/interpreting/interpreting.css`, `src/features/settings/SettingsPage.tsx`, `src/features/progress/ProgressPage.tsx`, `public/sw.js`, and `README.md`.

- [ ] Refine phone and laptop layouts for source transport, segment navigation, recording/replay, transcript editing, consent review, confidence badges, and feedback annotations; preserve keyboard focus, reduced motion, contrast, Arabic direction, and 44px touch targets.
- [ ] Verify that a fresh install can load the app shell and packaged audio offline after the initial cache fill, and that a selected clip still plays after network access is disabled. Show a recoverable offline-assets warning instead of silently loading a remote URL.
- [ ] Verify recording/replay in a secure localhost or HTTPS build on a current Chromium browser, Firefox, and Safari/iOS where available; record the actual MIME type and document unsupported combinations rather than assuming one codec works everywhere.
- [ ] Verify local recognition separately from recording: test an available `en-US` or `es-ES` language pack when the browser exposes it, test an unsupported target such as `zh-CN` through the manual transcript path, and confirm no recognition request occurs with `processLocally: false`.
- [ ] Verify local-only mode with browser network inspection: packaged asset requests may occur, but no learner audio, source transcript, learner transcript, evaluation request, or cloud response may leave the origin. Verify cloud fallback only after the consent dialog shows the exact audio part and text parts.
- [ ] Document microphone secure-context requirements, permission/replay behavior, asset rights policy, browser recognition limits, unsupported language directions, manual transcript degradation, storage/export/deletion, first-time model-pack downloads, and the practice-estimate disclaimer.
- [ ] Produce the final production build with `npm run build` and commit as `docs: document audio interpreting slice`.

## Research Notes

- `MediaDevices.getUserMedia()` is permission-gated and available only in a secure context such as HTTPS or localhost; the recording adapter therefore requests the microphone from a user action, handles permission/device errors, and stops tracks after use: <https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia>.
- `MediaRecorder` records a `MediaStream`, emits `dataavailable` data, and exposes `isTypeSupported()` for runtime MIME negotiation; the implementation must use the browser-supported type instead of assuming WebM, Ogg, or MP4: <https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder> and <https://w3c.github.io/mediacapture-record/>.
- Web Audio can create a `MediaStreamAudioSourceNode` from a microphone stream, and `AnalyserNode` exposes time-domain/frequency data without changing the stream. That is sufficient for a local waveform and coarse pause/active-speech heuristics, not a calibrated fluency or pronunciation score: <https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource>, <https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioSourceNode>, and <https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode>.
- The Web Speech API is not safely local by default: MDN states that the default recognition path is server-based and does not work offline. The on-device path requires experimental `processLocally`, a local language pack, `available()`/`install()`, and an allowed `on-device-speech-recognition` Permissions Policy: <https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API>, <https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally>, and <https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static>.
- Chrome documents on-device Web Speech support beginning in Chrome 139, but the feature is still capability- and language-dependent: <https://developer.chrome.com/release-notes/139>. Microsoft’s current local-model documentation lists only `en-US`, `de-DE`, `it-IT`, `pt-PT`, `es-ES`, and `ko-KR` for its Edge Canary/Dev preview and requires an experimental browser flag: <https://learn.microsoft.com/en-us/microsoft-edge/web-platform/speech-recognition-api>. Therefore this slice claims no automatic on-device recognition for learner targets `zh`, `ru`, `fr`, `hi`, or `ar`; those directions use manual transcript entry plus local audio-only delivery feedback unless a runtime capability check later proves otherwise.
- `SpeechRecognition.start()` can accept an audio `MediaStreamTrack`, and `SpeechRecognitionAlternative.confidence` exposes a numeric recognition estimate, but both APIs have limited browser availability and the confidence value is not calibrated learner certainty; the plan surfaces it and gates feedback on it instead of treating it as ground truth: <https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start> and <https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionAlternative/confidence>.

## Handoff Notes

- This slice implements interpreting only; exam simulation, personalized drills, sync, accounts, and classroom features remain outside the phase 2 boundary.
- The source catalog is usable offline after same-origin cache fill, but first-time service-worker and optional on-device language-pack downloads require network access. Learner audio and transcripts remain local in local-only mode.
- Browser-native local recognition is an optional enhancement, not a product-wide promise. Unsupported or low-confidence language directions remain usable through recording, replay, manual transcript confirmation, and explicitly labeled partial feedback.
- The cloud adapter remains user-configured and provider-capability-dependent. It sends audio only after per-task consent, with the exact payload shown; it never receives audio through the service worker cache.
- All interpreting scores remain practice estimates with evidence and uncertainty, not official CATTI or MTI results.

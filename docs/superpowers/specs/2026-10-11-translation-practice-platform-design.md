# Translation Practice Platform — Product Design

**Status:** Design prepared for user review
**Date:** 2026-10-11

## Product goal

Build a laptop- and phone-friendly practice platform for CATTI and MTI learners. It should let learners practise written translation, news translation, interpreting, and exam simulations; receive evidence-based feedback; and use their own error patterns to guide future exercises. The app should work without an account and keep learner data on the device by default.

The first audience is individual CATTI/MTI candidates studying independently. Teacher, classroom, cohort, payment, and social features are outside the initial scope.

## Product shape

Use an installable, responsive web app (PWA) as the shared laptop and phone experience. A learner can start without an account. Practice records, preferences, and progress remain in the local app store on that device. Cross-device sync is not included.

AI execution has two user-visible modes:

- **Local-only:** send no practice content to a remote AI service. If no suitable on-device model is available for a task, tell the learner and keep the task available for manual review.
- **Local-first with cloud fallback:** run locally when a verified model supports the task. Before any task is sent to a cloud service, show what will be sent and request explicit, task-specific consent. Never switch to cloud silently.

The app must determine and disclose model capability by device, task, and language direction. The design does not assume that one local model can deliver every feature on every phone. Local model/runtime choices will be validated against supported devices and languages before implementation commits to them.

## Languages and directions

The initial language set is Chinese, English, Russian, French, Hindi, Spanish, and Arabic. Exam-focused translation directions are Chinese to and from each of the other six languages (12 directed pairs). The interfaces and content model should allow additional language pairs later without redesigning practice modes.

Each exercise identifies its source and target language, script, difficulty, topic, and applicable exam profile. Text entry and feedback must render and edit all supported scripts correctly, including right-to-left Arabic.

## Practice modes

### Written translation

The learner selects an exercise and direction, reads the source passage, optionally consults an exercise glossary, and writes a translation in an editor. The session can be untimed or timed. On submission, the learner receives an overall practice assessment and dimension scores, annotated source/target spans, explanations, and a chance to revise.

### News translation

News exercises use dated, topic-tagged source material with a difficulty level and relevant terminology. The learner can practise headline, excerpt, or full-passage translation. Feedback addresses register, compression, context, and terminology in addition to the shared translation rubric. The platform may include only original, public-domain, licensed, or otherwise authorized source material.

### Audio interpreting

Exercises provide audio playback controls, repeat and chunk practice, recording, and consecutive or simultaneous practice modes. Learners can replay their response and review transcript-aligned feedback. The assessment separates meaning transfer and omissions from delivery measures such as fluency and pacing; it must show when speech recognition or audio analysis confidence is insufficient.

### Exam simulation

An exam profile configures task sequence, time limits, allowed aids, and post-exam feedback. Strict mode hides hints and feedback until submission. CATTI/MTI formats and rubrics must be versioned when configured; the app must label scores as practice estimates and must not imply official endorsement or certification.

## Feedback and learning loop

The shared feedback rubric covers:

- accuracy and meaning transfer;
- omissions, additions, and mistranslations;
- terminology and consistency;
- grammar and idiomatic expression;
- fluency, register, and task-specific style.

Feedback must point to the relevant source or learner-response span, explain the likely impact, and offer a concrete revision or exercise. It must accept multiple valid translations rather than treating one reference answer as the only correct answer. Where the model is uncertain or lacks enough evidence, it must say so instead of presenting a confident score.

After each session, the learner can mark feedback helpful or incorrect, revise the answer, save terminology, and add a mistake to a personal notebook. A local learner profile tracks performance by language direction, dimension, topic, and recurring error type. It recommends short targeted exercises and spaced review based on those records. The learner can inspect, export, or delete local practice data.

## Main screens

1. **Home:** continue practice, choose one of the four modes, see recent activity, and start a recommended exercise.
2. **Practice setup:** select mode, language direction, difficulty, topic, and timing; show whether the selected task can run locally.
3. **Practice workspace:** source/audio, glossary and permitted aids, answer editor or recorder, timer, and submit/revise actions.
4. **Feedback:** overall practice estimate, dimension scores, evidence annotations, explanations, alternatives, uncertainty, and revision actions.
5. **Progress:** skill trends, recurring weaknesses, saved terms, mistake notebook, and recommended drills.
6. **Privacy and data:** local-only/cloud-fallback setting, per-task cloud consent, local storage and model status, data export, and data deletion.

The interface must remain usable on a narrow phone screen and on a laptop. Audio recording controls and text editing receive touch-friendly layouts. The PWA shell and previously downloaded exercises should be usable offline; AI feedback is available offline only when a verified local model supports the exact task and device.

## System boundaries and data flow

The product is divided into focused modules:

- responsive app shell and mode-specific practice workspaces;
- versioned exercise and exam-profile catalog;
- practice-session service for timing, answer state, and revisions;
- evaluation service that applies a mode-specific rubric and validates structured model output;
- inference router with local and optional cloud adapters;
- local learner store for sessions, glossary, notebook, and progress;
- recommendation service that turns local error history into drills.

For a session, the app loads an exercise locally, records the learner's response in the local store, sends an evaluation request through the router, validates and displays the result, then updates the local learner profile. A cloud adapter receives only the selected task payload after task-specific consent. No background sync or analytics service is part of this design.

## Phased delivery

All four modes are part of the product scope. Delivery is staged around complete, usable practice loops:

1. **Foundation and written translation:** responsive PWA shell, local data store, privacy controls, language/direction selection, exercise catalog, written/news translation session, real evaluator adapter, annotated feedback, and locally stored progress.
2. **Interpreting:** local audio assets, playback/chunk controls, recording, transcript alignment, interpreting rubric, and confidence-aware feedback.
3. **Exam simulation:** versioned CATTI/MTI profiles, timed sequences, strict mode, and consolidated results.
4. **Personalized practice:** weakness-driven exercise generation, spaced review, progress trends, editable glossary, and mistake notebook.
5. **Capability expansion:** verify and enable additional local model/device combinations; offer explicit cloud fallback for unsupported local tasks and add language-pair coverage beyond the initial Chinese-centered directions when requested.

## Acceptance criteria

### First usable release

- A learner can install or open the app on a laptop or phone and begin without creating an account.
- The learner can complete a written translation session in all 12 initial directions using a verified execution mode: local, or cloud after explicit per-task consent.
- Feedback reports the agreed rubric dimensions, cites relevant evidence in the source/answer, explains revisions, allows multiple valid renderings, and indicates uncertainty.
- Session history and progress are stored on the current device and can be inspected, exported, and deleted.
- Local-only mode makes no AI-content network request. Cloud fallback never occurs without an explicit task-level confirmation.
- Core screens reflow at phone and laptop widths; Arabic text and right-to-left display are handled correctly.

### Complete product

- Learners can practise all four modes across the initial directions, including timed mock exams and personalized drills.
- Offline content and sessions remain available without a network. Inference availability is disclosed per task and device.
- Every score is presented as practice feedback with evidence and uncertainty handling, not as an official CATTI/MTI result.

## Risks and constraints

- Local model quality, latency, memory use, and speech support will vary by phone, laptop, language direction, and task. Device capability must be measured; unsupported combinations need a clear local-only limitation and an optional consent-based cloud path.
- AI translation assessment can miss valid alternatives or overstate small stylistic differences. Evaluation must anchor claims to evidence, permit multiple renderings, and expose uncertainty.
- Audio transcription can mistake speech recognition errors for interpreting errors. Feedback must distinguish recognition confidence from learner performance.
- News and exam materials require rights review. Only original, public-domain, licensed, or otherwise authorized content may ship.
- Local browser storage is tied to the current device/browser profile. The app must explain this clearly while sync is out of scope.

## Decisions deferred

- Exact local inference runtimes and model selection, pending device and language capability research.
- Specific CATTI/MTI exam levels and rubric versions to ship first; profiles must be based on verified, current exam materials.
- Account, payment, classroom, and cross-device sync designs.
- Additional language-pair directions beyond Chinese to/from the other six initial languages.

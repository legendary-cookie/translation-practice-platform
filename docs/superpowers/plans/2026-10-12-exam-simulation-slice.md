# Translation Practice Platform — Exam Simulation Implementation Plan

> **For agentic workers:** Use the executing-plans workflow to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase 3 of the translation practice platform: a realistic, local-first exam simulation mode for CATTI and MTI candidates. It provides versioned exam profiles, multi-section timed runs with dual timers, crash and reload recovery from IndexedDB, strict test-taking mode, consolidated multi-passage AI feedback, mandatory practice-estimate labeling, original authorized materials, and laptop/phone/RTL layouts.

**Architecture:** Extend the Phase 1 foundation established in `translation-practice-platform-4`. Upgrade IndexedDB from schema version 1 to 2 by adding stores for versioned `examProfiles`, active `examRuns` (for crash-proof draft persistence), and immutable `examResults`. Reuse the Phase 1 domain contracts (`src/domain/`) and evaluation provider interface (`src/ai/provider.ts`), evaluating multi-passage submissions through local WebLLM or consent-gated cloud providers without modifying inference engine boundaries. Render simulations through responsive split-pane (laptop) and stacked (mobile) layouts with bidirectional text support for Arabic.

**Tech Stack:** Vite, React, TypeScript, `idb` for IndexedDB schema migration and transaction storage, `@mlc-ai/web-llm` and cloud provider boundary from Phase 1, native Web Storage/IndexedDB recovery events, and vanilla CSS with no external fonts or assets.

**Specs & Research References:**
- Product Specification: `docs/superpowers/specs/2026-10-11-translation-practice-platform-design.md` (Exam simulation, Phased delivery item 3, Decisions deferred).
- Phase 1 Implementation Plan: `docs/superpowers/plans/2026-10-11-written-translation-release.md`.
- Part 1 Authoritative Research: `C:/Users/Zhen Li/.ao/data/artifacts/translation-practice-platform-1/catti-mti-exam-profiles.md`.

---

## Global Constraints

- **Independent Study Audience**: Individual CATTI and MTI candidates studying independently on laptop or mobile devices without requiring user accounts or network logins.
- **Strictly Versioned Profiles & Immutability**: Every exam profile has an explicit immutable version (e.g., `catti-2-practical-en-zh-v1`). Exam results store full snapshots of profile configuration and rubric version at the time of completion so future profile updates never silently rewrite historical results.
- **Strict Mode Enforcement**: In exam mode, inline glossaries, vocabulary tooltips, and interactive hints are completely hidden. AI evaluation requests are blocked until final exam submission. Source text copy-pasting is restricted to simulate real CATTI electronic testing client ergonomics.
- **Mandatory Practice Estimate Disclaimers**: Every score, grade, and evaluation summary is prominently labeled as an AI practice assessment. The app must never claim or imply official endorsement, certification, or affiliation with CIPG (中国外文局), ATICICG (翻译院), CPTA (人事考试网), the Ministry of Education, or any MTI university.
- **Original & Authorized Passage Material**: Only original authorings or public-domain/open-licensed texts (e.g., public government reports, historical treaties) may be used. The platform strictly prohibits verbatim reproduction of copyrighted past CATTI/MTI exam papers.
- **Timing & Crash Recovery**: Supports multi-section dual-timer tracking (section remaining time and overall exam countdown). Active runs auto-save drafts to IndexedDB every 3 seconds and on blur; accidental tab closure or browser crashes can be resumed seamlessly without loss of work or timer corruption.
- **Responsive & Bidirectional Layout**: Full support for laptop side-by-side translation workbenches, mobile touch-friendly stacked views, and right-to-left (RTL) rendering for Arabic scripts.
- **Language Pair Realism & Catalog Boundary**: CATTI simulation profiles are restricted to verified CATTI languages (English, French, Russian, Spanish, Arabic). Hindi is explicitly excluded from CATTI simulation because CATTI does not administer Hindi exams (`[UNVERIFIED: Hindi CATTI offering — confirmed absent]`).

---

## Carried-Over Research & Uncertainty Flags

From Part 1 Research (`catti-mti-exam-profiles.md`), the following verified facts and uncertainty flags govern profile values:

1. **CATTI Level 2 《笔译实务》 (`catti-2-practical-en-zh-v1`)**:
   - *Verified Parameters*: 180 minutes duration; 100 points maximum; Section 1: English-to-Chinese (2 passages, ~900–1000 words total, 50 points); Section 2: Chinese-to-English (2 passages, ~600 characters total, 50 points).
   - *Aids Policy*: 2 printed paper bilingual general dictionaries permitted in real exam; simulated in UI with paper dictionary guideline modal and external aid policy indicator.
   - *Passing Standard*: 60 / 100 points (must pass both 实务 and 综合 in same sitting in reality).
2. **MTI 357 《英语翻译基础》 Baseline (`mti-357-foundation-en-zh-v1`)**:
   - *Verified Parameters*: 180 minutes duration; 150 points maximum; Section 1: Terminology Translation (15 E->C, 15 C->E, 30 points, recommended 35 min); Section 2: English-to-Chinese Passage (~300 words, 60 points, recommended 70 min); Section 3: Chinese-to-English Passage (~200 characters, 60 points, recommended 75 min).
   - *Aids Policy*: Strictly closed-book (闭卷); NO dictionaries, NO electronic aids.
   - *Passing Standard*: Annual national line (`单科线` typically 71–83/150) plus autonomous university re-examination cutoffs.
3. **`[UNVERIFIED: Micro-Deduction Point Tables]`**:
   - Neither ATICICG nor MOE publishes a public, granular deduction schedule (e.g. -1 pt per grammatical slip). Official marking uses human holistic double-blind scoring ("双评机制").
   - *Implementation Rule*: Automated scoring maps Phase 1 rubric dimensions (`accuracy`, `terminology`, `grammar`, `fluency`, `taskStyle`) to a simulated 0–100 or 0–150 aggregate score without claiming official algorithmic deduction parity.
4. **`[UNVERIFIED: Non-English CATTI Practical Sub-allocations]`**:
   - While English Level 2 is 50/50, French Level 2实务 is officially 60 pts (法译汉) and 40 pts (汉译法).
   - *Implementation Rule*: Non-English profiles must explicitly define per-section point weights rather than assuming a rigid 50/50 split.
5. **`[UNVERIFIED: MTI University Variation]`**:
   - Admitting universities autonomously formulate their 357 papers; terminology counts vary between 20 and 40 terms.
   - *Implementation Rule*: MTI profiles must be explicitly badged as "MTI 357 Steering Committee Guidance Baseline (教指委指导大纲标准模版)".

---

## Files and Responsibilities

### Existing Files Modified

- `src/domain/types.ts`: Extend domain contracts with exam profile schemas, exam run lifecycle, multi-section configuration, permitted aids, and consolidated feedback results.
- `src/domain/scoring.ts`: Add multi-section exam score aggregation, weighted dimension normalization, and historical benchmark comparison utilities.
- `src/storage/database.ts`: Migrate IndexedDB database from version 1 to 2; add `examProfiles`, `examRuns` (active in-progress draft runs), and `examResults` object stores; update `exportData` and `clearData` to include exam entities.
- `src/App.tsx`: Add top-level navigation routes for `exam` mode and propagate active exam banner / state.
- `src/features/dashboard/Dashboard.tsx`: Unlock the "Exam Simulation" mode card, display recent mock exam results, and provide direct resumption of in-progress runs.
- `src/features/progress/ProgressPage.tsx`: Incorporate mock exam scores, benchmark trends, and exam history into the learner analytics dashboard.
- `src/styles.css`: Add global layout styles for full-width exam views, timer badges, and responsive containers.

### New Files Created

- `src/domain/exam.ts`: Pure domain logic for exam state transitions, dual-timer math, section progression rules, auto-lock mechanics, and crash-recovery validation.
- `src/data/exam-profiles.ts`: Built-in catalog of verified, versioned exam profiles (`catti-2-practical-en-zh-v1`, `mti-357-foundation-en-zh-v1`, and starter profiles for French and Arabic) with original, rights-cleared passage texts.
- `src/features/exam/ExamCatalog.tsx`: Profile selection screen showing official parameters, passage word counts, permitted aids, duration, and disclaimer.
- `src/features/exam/ExamRunner.tsx`: Primary exam workspace controller orchestrating active run lifecycle, IndexedDB auto-save, crash reload detection, dual timers, and final submission modal.
- `src/features/exam/ExamHeader.tsx`: Sticky test-taking navigation header displaying dual countdown timers (section & total), section progress steps, aid indicators, and strict-mode banner.
- `src/features/exam/ExamSectionWorkspace.tsx`: Section-specific translation workspace with source passage viewer, character/word counters, paste-restricted textarea, RTL support, and section navigation.
- `src/features/exam/ExamResultsReport.tsx`: Consolidated multi-section scorecard with practice disclaimer, overall scaled score, syllabus benchmark comparison, per-passage evidence annotations, and export actions.
- `src/features/exam/exam.css`: Responsive styles for split-pane desktop workstation, mobile stacked layouts, high-contrast timer alerts, and RTL text adjustments.

---

## Tasks

### Task 1: Define versioned exam domain contracts and storage upgrade

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/storage/database.ts`
- Create: `src/domain/exam.ts`

**Interfaces:**
- `ExamType`: `'CATTI' | 'MTI'`.
- `ExamLevel`: `'Level 1' | 'Level 2' | 'Level 3' | 'MTI 357' | 'MTI 448'`.
- `ExamAidPolicy`: `{ paperDictionaryAllowed: boolean; onlineSearchAllowed: false; glossaryAllowed: false; notes: string }`.
- `ExamPassage`: `{ id: string; title: string; sourceText: string; wordCount: number; targetLanguage: LanguageCode; recommendedPace?: string }`.
- `ExamSectionConfig`: `{ id: string; title: string; direction: string; taskType: 'translation' | 'terminology' | 'proofreading'; timeLimitMinutes: number; maxPoints: number; passages: ExamPassage[] }`.
- `ExamProfile`: `{ id: string; version: number; examType: ExamType; level: ExamLevel; sourceLanguage: LanguageCode; targetLanguage: LanguageCode; title: string; description: string; totalDurationMinutes: number; maxTotalPoints: number; passBenchmarkPoints: number; benchmarkType: 'fixed-60-percent' | 'national-line-estimate'; sections: ExamSectionConfig[]; allowedAids: ExamAidPolicy; disclaimer: string }`.
- `ActiveExamRun`: `{ id: string; profileId: string; profileVersion: number; status: 'in-progress' | 'completed' | 'abandoned'; startedAt: string; lastSavedAt: string; currentSectionIndex: number; overallRemainingSeconds: number; sectionRemainingSeconds: Record<string, number>; answers: Record<string, Record<string, string>> }`.
- `ConsolidatedExamResult`: `{ id: string; runId: string; completedAt: string; profileId: string; profileVersion: number; examTitle: string; totalScore: number; maxScore: number; percentage: number; passBenchmark: number; estimatedStatus: 'above-benchmark' | 'near-benchmark' | 'below-benchmark'; sectionResults: { sectionId: string; sectionTitle: string; score: number; maxPoints: number; passageFeedbacks: { passageId: string; passageTitle: string; feedback: TranslationFeedback }[] }[]; consolidatedDimensions: FeedbackDimensions; disclaimer: string }`.
- `database`: Upgrade to version 2; add object stores `'examProfiles'`, `'examRuns'`, and `'examResults'`. Implement `getActiveExamRun()`, `saveExamRun(run)`, `deleteExamRun(id)`, `saveExamResult(result)`, `getExamResult(id)`, `listExamResults()`.

- [x] Extend `src/domain/types.ts` with complete `ExamProfile`, `ExamSectionConfig`, `ActiveExamRun`, and `ConsolidatedExamResult` types.
- [x] Implement `src/domain/exam.ts` with timer deduction logic, section boundary checks, crash recovery state validation, and practice estimate labeling constants.
- [x] Migrate `src/storage/database.ts` schema to version 2, creating indexed stores for `examProfiles`, `examRuns` (indexed by status and lastSavedAt), and `examResults` (indexed by completedAt and profileId).
- [x] Implement auto-recovery queries in `database` to retrieve the latest unfinished `ActiveExamRun`.
- [x] Update `exportData` and `clearData` in `database.ts` to cleanly export and wipe exam runs and results.
- [x] Run `npm run build` to verify type and storage compilation.

---

### Task 2: Implement verified default exam profiles with original passages

**Files:**
- Create: `src/data/exam-profiles.ts`
- Modify: `src/storage/database.ts`

**Interfaces:**
- `DEFAULT_EXAM_PROFILES`: `ExamProfile[]` exported catalog.
- `initExamProfiles()`: Utility to seed built-in profiles into IndexedDB if not already present.

- [x] Author `catti-2-practical-en-zh-v1` (CATTI English Level 2 实务):
  - 180 min total duration, 100 max points, 60 pass threshold.
  - Section 1: English-to-Chinese Translation (50 pts, 90 min recommended): 2 original passages (Passage 1: ~480 words on international trade logistics; Passage 2: ~460 words on renewable energy grids; total ~940 words).
  - Section 2: Chinese-to-English Translation (50 pts, 90 min recommended): 2 original passages (Passage 1: ~310 Chinese characters on rural revitalization; Passage 2: ~290 Chinese characters on cultural heritage digitization; total ~600 chars).
  - Aids: Paper bilingual dictionaries permitted; electronic aids strictly prohibited.
- [x] Author `mti-357-foundation-en-zh-v1` (MTI 357 English Translation Foundation Guidance Baseline):
  - 180 min total duration, 150 max points, benchmark 80 (estimated national line).
  - Section 1: Terminology Translation (30 pts, 35 min recommended): 15 original E->C acronyms/terms + 15 original C->E terms.
  - Section 2: English-to-Chinese Passage (60 pts, 70 min recommended): 1 original high-register passage (~320 words on AI ethics).
  - Section 3: Chinese-to-English Passage (60 pts, 75 min recommended): 1 original formal passage (~220 characters on sustainable urbanization).
  - Aids: Strictly closed-book; no dictionaries allowed.
- [x] Author starter multi-language CATTI profiles:
  - `catti-2-practical-fr-zh-v1` (French Level 2, 180 min, 60/40 point weighting, 2 original French passages ~800 words total, 2 Chinese passages ~500 chars total).
  - `catti-2-practical-ar-zh-v1` (Arabic Level 2, 180 min, 50/50 point weighting, RTL enabled, original formal Arabic texts ~800 words total, 2 Chinese passages ~600 chars total).
- [x] Ensure all passages are original compositions or public-domain translations; strictly audit against verbatim copying of past copyrighted CATTI/MTI exam papers.
- [x] Embed explicit practice disclaimers and rubric version tags (`rubric-v1`) into each profile definition.
- [x] Run `npm run build` to verify profile data integrity.

---

### Task 3: Build active exam runner with dual timers, strict mode, and crash recovery

**Files:**
- Create: `src/features/exam/ExamRunner.tsx`
- Create: `src/features/exam/ExamHeader.tsx`
- Create: `src/features/exam/ExamSectionWorkspace.tsx`
- Create: `src/features/exam/exam.css`
- Modify: `src/styles.css`

**Interfaces:**
- `ExamRunnerProps`: `{ profile: ExamProfile; existingRunId?: string; onFinish: (resultId: string) => void; onCancel: () => void }`.
- `ExamHeaderProps`: `{ title: string; sectionTitle: string; sectionIndex: number; totalSections: number; overallSeconds: number; sectionSeconds: number; aidPolicy: ExamAidPolicy; onOpenAidsModal: () => void; onSubmitEarly: () => void }`.
- `ExamSectionWorkspaceProps`: `{ section: ExamSectionConfig; answers: Record<string, string>; onAnswerChange: (passageId: string, text: string) => void; onNextSection: () => void; isLastSection: boolean }`.

- [x] Implement active run initialization in `ExamRunner`: create new `ActiveExamRun` in IndexedDB or load existing incomplete run if resuming.
- [x] Implement dual countdown timer using `requestAnimationFrame` or `setInterval` combined with wall-clock diffing (`Date.now()`) to prevent timer drift when tab is backgrounded.
- [x] Implement debounced auto-save (every 3 seconds and on text blur) persisting user input and remaining seconds to `database.saveExamRun`.
- [x] Build crash/reload detection: when user navigates to exam mode with an unfinished run, prompt with "Resume In-Progress Exam" modal showing remaining time and last saved timestamp.
- [x] Enforce strict test-taking constraints:
  - Hide glossary sidebar and disable AI hint buttons.
  - Disable clipboard pasting into answer textarea from source text container via `onPaste` guard to simulate CATTI client typing environment.
  - Display sticky warning banner if user attempts to leave screen without submitting.
- [x] Implement section locking and auto-advance: when section time expires, show countdown warning, lock current section inputs, and advance to next section. When overall exam timer hits zero, trigger automatic final submission.
- [x] Support responsive workspace layout:
  - Laptop: side-by-side split screen with source passage on left and translation editor on right.
  - Phone: compact stacked view with sticky timer bar, touch tabs for passages, and full-screen editor toggle.
  - Arabic support: dynamic `dir="rtl"` applied when source or target language is Arabic (`ar`), ensuring proper cursor and text flow.
- [x] Run `npm run build` to verify workspace components and CSS compilation.

---

### Task 4: Implement multi-section consolidated evaluation and disclaimer-backed results reporting

**Files:**
- Modify: `src/domain/scoring.ts`
- Create: `src/features/exam/ExamResultsReport.tsx`
- Modify: `src/features/exam/ExamRunner.tsx`

**Interfaces:**
- `evaluateExamRun(run, profile, provider)`: Orchestrates batch evaluation of all answered passages using the Phase 1 `EvaluationProvider`.
- `aggregateExamFeedback(feedbacks, profile)`: Consolidates individual passage dimension scores into a weighted final exam score and overall dimension averages.
- `ExamResultsReportProps`: `{ result: ConsolidatedExamResult; onRetake: () => void; onBackToDashboard: () => void }`.

- [x] In `src/domain/scoring.ts`, implement `aggregateExamScores(feedbacks, profile)`:
  - Calculate weighted score per section and overall percentage.
  - Normalize to exam max points (e.g. 100 for CATTI, 150 for MTI).
  - Compute weighted averages for the five core dimensions: `accuracy`, `terminology`, `grammar`, `fluency`, and `taskStyle`.
  - Compare overall estimate against profile benchmark (e.g., 60% for CATTI Level 2) with qualitative categorization (`Above Benchmark`, `Near Benchmark`, `Below Benchmark`).
- [x] Implement sequential or parallel evaluation batching in `ExamRunner` on submission:
  - For each answered passage, invoke `provider.evaluate({ exercise: passageExercise, learnerAnswer, mode: 'written' })`.
  - Validate all returned feedbacks via Phase 1 `validateFeedback` to ensure exact evidence quote integrity.
  - Construct `ConsolidatedExamResult`, persist to IndexedDB store `examResults`, and delete the transient `ActiveExamRun`.
- [x] Build `ExamResultsReport.tsx`:
  - Prominent mandatory practice estimate banner:
    > "Practice Assessment Only: This score is an automated estimation generated for independent study. It is NOT an official CATTI or MTI examination result and has no official certification standing."
  - Scaled overall score display (e.g., `72 / 100` with 60-point benchmark line).
  - Radar or bar breakdown of the 5 core rubric dimensions.
  - Section-by-section collapsible accordion with full source passage, learner translation, and annotated evidence quotes (issues and strengths).
  - Export action enabling JSON download of the complete result report.
- [x] Run `npm run build` and verify results rendering and calculation.

---

### Task 5: Build exam catalog, dashboard integration, and progress tracking

**Files:**
- Create: `src/features/exam/ExamCatalog.tsx`
- Modify: `src/features/dashboard/Dashboard.tsx`
- Modify: `src/features/progress/ProgressPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `ExamCatalogProps`: `{ onSelectProfile: (profile: ExamProfile) => void; onResumeRun: (runId: string) => void; activeRun?: ActiveExamRun }`.
- `App`: Handle `page === 'exam'` state; switch between catalog, active runner, and results report.

- [x] Build `ExamCatalog.tsx`:
  - List available verified profiles (CATTI Level 2, MTI 357, French Level 2, Arabic Level 2).
  - Display syllabus specifications: exam type, level, total minutes, passage count, word count, permitted aids badge (e.g., "Paper Dictionaries Permitted" vs "Closed Book").
  - Provide language direction filter (e.g., EN <-> ZH, FR <-> ZH, AR <-> ZH).
  - Show active in-progress run alert banner with "Resume" and "Discard" actions if an active run exists.
  - Prominently display the official practice disclaimer.
- [x] Update `Dashboard.tsx`:
  - Change "Exam simulation" card status from planned to active.
  - Show active mock exam banner if an unfinished run is stored in IndexedDB.
  - Display summary card of recent mock exam scores.
- [x] Update `ProgressPage.tsx`:
  - Add "Mock Exams" tab or section alongside written translation practice history.
  - Show historical mock exam scores, benchmark status, and dimension trends over time.
- [x] Wire up navigation in `App.tsx` to handle exam catalog, runner, and result view transitions without losing state.
- [x] Run `npm run build` to verify application wiring and navigation.

---

### Task 6: Implement responsive laptop/phone UI, Arabic RTL validation, and packaging

**Files:**
- Modify: `src/features/exam/exam.css`
- Modify: `src/styles.css`
- Modify: `README.md`

- [x] Refine responsive exam styles:
  - Desktop: dual split-screen with independent scrolling, high-visibility sticky timer bar, and distraction-free header.
  - Mobile: compact responsive header, swipeable or tabbed passage switcher, large touch targets for navigation, and sticky bottom timer.
- [x] Verify right-to-left (RTL) Arabic ergonomics:
  - Check `dir="rtl"` styling on Arabic source passages and target textareas.
  - Ensure correct cursor placement, text selection, and punctuation alignment in mixed Arabic-English/Chinese contexts.
- [x] Implement copy-paste restrictions and test-day ergonomics:
  - Disable right-click context menu and paste events on source text in strict mode.
  - Add live character and word counters updating on input.
- [x] Update `README.md` with:
  - Documentation of the Exam Simulation mode.
  - Verified CATTI and MTI profiles and syllabus baselines.
  - Permitted aids policy and strict mode behavior.
  - Mandatory practice estimate disclaimer and copyright compliance notice.
  - Offline local-first execution boundaries.
- [x] Execute clean production build with `npm run build` and ensure zero TypeScript errors and zero packaging warnings.

---

## Research Notes

- **CATTI Official Regulatory Standards**: Ministry of Human Resources and Social Security (MOHRSS) Notice on Fixed Standards for Professional Technical Personnel Qualification Examinations (*人力资源社会保障部办公厅关于部分专业技术人员职业资格考试实行相对固定合格标准有关事项的通告*), fixing passing scores at 60% of total score (60/100 points) across both papers in a single sitting: <http://www.cpta.com.cn>.
- **CATTI Electronic Testing & Aids**: CPTA Official Candidate Instructions for Translation Qualification Examinations (*全国翻译专业资格（水平）考试考场规则*), mandating computer-based testing nationwide since 2019H2 and allowing two printed paper bilingual general dictionaries for 《笔译实务》 while strictly forbidding electronic dictionaries, specialized dictionaries, and all aids for 《笔译综合能力》: <http://www.cpta.com.cn> and <http://www.catticenter.com>.
- **CATTI Syllabus Authority**: China Foreign Languages Publishing Administration Translation Qualification Evaluation Center (中国外文局翻译院 / 考评中心), publishing official syllabi for English, French, Russian, Spanish, Arabic, Japanese, German, Korean, Portuguese: <http://www.aticicg.org.cn>.
- **MTI Regulatory Standards**: National MTI Education Steering Committee (*全国翻译硕士专业学位教育指导委员会*), *《全日制翻译硕士专业学位（MTI）研究生入学考试指南》* (2009), defining 101, 211, 357, and 448 papers, with 357 comprising 30 points terminology and 120 points passage translation (180 minutes, 150 points total): <https://yz.chsi.com.cn>.
- **MTI Closed-Book Practice**: Ministry of Education National Postgraduate Entrance Examination Administration Regulations (*全国硕士研究生招生工作管理规定*), universally enforcing closed-book testing without dictionaries in national examination centers: <https://yz.chsi.com.cn>.
- **Web Storage & IndexedDB Resilience**: W3C IndexedDB 3.0 specification on persistent object stores and transactional integrity for crash recovery during long-running client sessions: <https://www.w3.org/TR/IndexedDB-3/>.

---

## Handoff Notes

- **Separation of Plan vs Sibling Implementation**: This plan strictly targets Phase 3 (Exam Simulation) and extends the Phase 1 codebase without modifying or breaking existing written/news practice components.
- **Copyright Integrity**: All passages specified in `src/data/exam-profiles.ts` must be original or open-licensed. Under no circumstances should official past CATTI or university MTI test papers be scraped or stored in the repository.
- **No Certification Claim**: UI elements and output JSON data structures must strictly carry the practice estimate disclaimer to avoid misleading candidates or infringing on official examination trademarks.

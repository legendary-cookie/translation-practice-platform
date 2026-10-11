# Translation Practice Platform — Personalized Practice Implementation Plan

> **For agentic workers:** Use the executing-plans workflow to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase 4 (Personalized Practice) of the CATTI/MTI platform, adding a locally derived learner profile, weakness-driven exercise selection and generation, an SM-2 spaced repetition review loop, an editable glossary, a mistake notebook with feedback helpful/incorrect signals, and non-extrapolated progress trends with full RTL Arabic support and local-only guarantees.

**Architecture:** Extend the Phase 1 React/TypeScript PWA without restructuring its foundation. Upgrade IndexedDB from version 1 to version 2 with backward-compatible migrations. Maintain learner profile statistics derived on-the-fly or cached from locally stored sessions. Recommend practice through a two-tier strategy: deterministic catalog selection and template-based notebook reconstruction (zero network, 100% offline), alongside an optional model-generated drill path protected by strict pre-display linguistic validation and per-task cloud consent. Power spaced reviews for saved vocabulary and notebook mistakes using an auditable, deterministic SM-2 algorithm. Render all interfaces responsively across phone and laptop screens with full right-to-left (RTL) Arabic bidirectional text isolation.

**Tech Stack:** Vite, React, TypeScript, `idb` (IndexedDB schema migration from v1 to v2), `@mlc-ai/web-llm` (pinned to 0.2.82 for local generation if available), pure TypeScript implementation of the SuperMemo-2 (SM-2) algorithm, native HTML5 `<bdi>` and CSS logical properties for bidirectional layout, and standard Canvas/SVG for non-extrapolated charts without external charting bloat.

**Spec:** `docs/superpowers/specs/2026-10-11-translation-practice-platform-design.md`

---

## Global Constraints

- **Scope boundaries:** Individual CATTI and MTI candidates studying independently. Cross-device sync, user accounts, server databases, and social feeds remain strictly out of scope.
- **Language pairs:** Support the initial seven languages (Chinese, English, Russian, French, Hindi, Spanish, Arabic) across the 12 Chinese-centered directed translation pairs.
- **Zero-network local operation:** Profile aggregation, catalog-based weakness selection, notebook cloze generation, and spaced repetition review schedules must run 100% offline with zero network calls.
- **Privacy & cloud consent:** Model-generated drills in local-only mode must never make network requests. In cloud-fallback mode, an explicit per-task confirmation modal displaying the exact prompt payload must be approved by the learner before dispatch.
- **No data hallucination:** Progress trends must never invent, smooth, or extrapolate imaginary baseline points for new learners. Sessions 0, 1–2, and 3+ must degrade gracefully with explicit state disclosures.
- **Safe data lifecycle:** Extend Phase 1 `exportData()` and `clearData()` paths. Export must produce a versioned v2 JSON bundle containing settings, sessions, glossary, mistakes, and feedback ratings.
- **Small on-device model realism:** On-device 1.7B LLMs have documented failure modes in multi-script generation (especially Hindi, Arabic, and Russian idioms). Model-generated drills must pass rigorous linguistic/entropy validation gates before display; on failure, the system falls back seamlessly to catalog exercises.
- **Non-destructive migration:** Existing Phase 1 IndexedDB sessions and settings must be preserved without data loss when upgrading store schemas from version 1 to 2.

---

## Files and Responsibilities

### Modify (Existing Phase 1 Files)
- `src/domain/types.ts`: Extend domain contracts with `GlossaryEntry`, `MistakeEntry`, `FeedbackRating`, `RepetitionState`, `LearnerProfile`, `RecommendedDrill`, and `GeneratedExerciseDraft`.
- `src/domain/scoring.ts`: Add discount weighting for feedback issues flagged as `incorrect` and extract rubric-aligned error statistics.
- `src/storage/database.ts`: Upgrade IndexedDB schema from version 1 to version 2; add object stores for `glossary`, `mistakes`, `feedback_ratings`, and `profile_cache`; update `exportData()` and `clearData()`.
- `src/ai/provider.ts`: Add optional `generateExercise` capability to the evaluator provider boundary.
- `src/ai/local-provider.ts`: Implement local worker exercise generation with task constraints.
- `src/ai/cloud-provider.ts`: Implement opt-in cloud exercise generation with explicit consent payloads.
- `src/features/practice/FeedbackPanel.tsx`: Add 👍 Helpful / 👎 Incorrect rating actions per feedback issue, "Save to Glossary", and "Add to Mistake Notebook" triggers.
- `src/features/practice/practice.css`: Style feedback action chips, term save popovers, and rating confirmations.
- `src/features/dashboard/Dashboard.tsx`: Add "Due Spaced Reviews" banner and "Weakness Focus Drill" recommendation launcher.
- `src/features/progress/ProgressPage.tsx`: Replace simple list with comprehensive, non-extrapolated progress analytics, dimension radar/bar breakdown, and weakness diagnosis.
- `src/features/progress/progress.css`: Responsive styles for progress analytics, metric cards, and graceful degradation empty states.
- `src/features/settings/SettingsPage.tsx`: Expand data management section with storage breakdown inspection, v2 JSON export, and granular store deletion.
- `src/features/settings/settings.css`: Styles for data inspection tables and deletion dialogs.
- `src/App.tsx`: Register routes/tabs for Spaced Review, Mistake Notebook, and Glossary management.
- `src/styles.css`: Add CSS logical properties and bidirectional isolation utilities (`[dir="rtl"]`, `<bdi>`).
- `README.md`: Document personalized practice features, SM-2 review logic, v2 storage schema, and offline limitations.

### Create (New Phase 4 Files)
- `src/domain/spaced-repetition.ts`: Deterministic implementation of the SuperMemo-2 (SM-2) algorithm, grade mapping, interval calculations, and next review scheduling.
- `src/domain/profile.ts`: Pure functional aggregation logic converting local `SessionRecord[]` and `FeedbackRating[]` into a structured `LearnerProfile`.
- `src/domain/exercise-generator.ts`: Recommendation engine (deterministic catalog matching, template-based notebook reconstruction drills) and strict linguistic validation for model-generated drills.
- `src/ai/generation-prompt.ts`: Structured prompt templates for targeted exercise generation across language pairs and difficulty tiers.
- `src/features/review/ReviewSession.tsx`: Interactive flashcard spaced repetition player with keyboard shortcuts, touch gestures, and grade interval previews.
- `src/features/review/Flashcard.tsx`: Card presentation component with dynamic `dir="rtl"` / `dir="ltr"` handling and bidirectional isolation for Arabic.
- `src/features/review/GlossaryManager.tsx`: Searchable, editable terminology table with language filtering, inline editing, and manual addition.
- `src/features/review/MistakeNotebook.tsx`: Categorized mistake browser grouped by rubric dimension, with note editing, status management, and reconstruction drill shortcuts.
- `src/features/review/review.css`: Responsive styles for flashcards, grade buttons, notebook cards, and glossary tables.

---

## Tasks

### Task 1: Extend domain contracts, SM-2 spaced repetition engine, and profile aggregation

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/scoring.ts`
- Create: `src/domain/spaced-repetition.ts`, `src/domain/profile.ts`

**Interfaces:**
```typescript
// src/domain/types.ts additions

export type RubricDimensionKey =
  | 'accuracy'
  | 'omissions_additions'
  | 'terminology'
  | 'grammar'
  | 'fluency_style';

export type ReviewGrade = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

export interface RepetitionState {
  repetitions: number;      // Continuous success count (n)
  intervalDays: number;     // Current interval in days (I)
  easinessFactor: number;   // Easiness factor (EF >= 1.3, default 2.5)
  dueDate: string;          // ISO 8601 date string for next review
  lastReviewedAt: string | null;
}

export interface GlossaryEntry {
  id: string;
  sourceTerm: string;
  targetTerm: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  notes?: string;
  tags: string[];           // e.g. ["politics", "catti2", "diplomacy"]
  reviewState: RepetitionState;
  createdAt: string;
  updatedAt: string;
}

export interface MistakeEntry {
  id: string;
  sessionId: string;
  exerciseId: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  sourceSnippet: string;
  learnerSnippet: string;
  suggestedCorrection: string;
  dimension: RubricDimensionKey;
  errorType: string;        // e.g. "omission", "false_friend", "unidiomatic_collocation"
  userNotes?: string;
  status: 'active' | 'mastered' | 'archived';
  reviewState: RepetitionState;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackRating {
  id: string;               // `${sessionId}_${issueIndex}`
  sessionId: string;
  issueIndex: number;
  rating: 'helpful' | 'incorrect';
  correctionNote?: string;
  createdAt: string;
}

export interface DirectionStats {
  direction: string;        // e.g. "zh->en"
  sessionCount: number;
  averageOverallScore: number;
  dimensionAverages: Record<RubricDimensionKey, number>;
  lastPracticedAt: string;
}

export interface ErrorTypeStat {
  errorType: string;
  dimension: RubricDimensionKey;
  count: number;
  disputedCount: number;    // Marked incorrect by learner
  helpfulCount: number;     // Marked helpful by learner
  lastSeenAt: string;
}

export interface LearnerProfile {
  totalSessions: number;
  status: 'new' | 'baseline' | 'established'; // 0, 1-2, >=3 sessions
  directions: Record<string, DirectionStats>;
  dimensions: Record<RubricDimensionKey, { averageScore: number; trend: 'improving' | 'declining' | 'stable' }>;
  topics: Record<string, { sessionCount: number; averageScore: number }>;
  recurringErrors: ErrorTypeStat[];
  weakestDimension: RubricDimensionKey | null;
  weakestDirection: string | null;
  lastCalculatedAt: string;
}

export interface RecommendedDrill {
  id: string;
  strategy: 'spaced_review' | 'catalog_weakness' | 'notebook_reconstruction' | 'model_generated';
  title: string;
  reason: string;
  priorityScore: number;
  exercise?: Exercise;
  reviewCount?: number;
  mistakeId?: string;
}
```

```typescript
// src/domain/spaced-repetition.ts
export function createInitialRepetitionState(now?: Date): RepetitionState;
export function calculateSM2(state: RepetitionState, grade: ReviewGrade, now?: Date): RepetitionState;
export function isDueForReview(state: RepetitionState, now?: Date): boolean;
export function formatIntervalPreview(state: RepetitionState, grade: ReviewGrade): string;
```

```typescript
// src/domain/profile.ts
export function buildLearnerProfile(
  sessions: SessionRecord[],
  ratings: FeedbackRating[]
): LearnerProfile;
```

- [ ] Define updated TypeScript interfaces in `src/domain/types.ts` for glossary, mistake notebook, feedback ratings, repetition state, and aggregated profile.
- [ ] Implement `src/domain/spaced-repetition.ts` with pure SM-2 logic:
  - Default $EF = 2.5$, minimum $EF = 1.3$.
  - Grade 1 (Again): $n = 0$, $I = 1$ day, $EF' = EF$.
  - Grade 2 (Hard): $n = n + 1$, $I = \max(1, \text{round}(I \times 1.2))$, $EF' = \max(1.3, EF - 0.15)$.
  - Grade 3 (Good): if $n=0 \implies I=1$; if $n=1 \implies I=6$; else $I = \text{round}(I \times EF)$; $n = n + 1$; $EF' = \max(1.3, EF + (0.1 - (5 - 4) \times (0.08 + (5 - 4) \times 0.02)))$.
  - Grade 4 (Easy): if $n=0 \implies I=2$; if $n=1 \implies I=7$; else $I = \text{round}(I \times EF \times 1.3)$; $n = n + 1$; $EF' = \max(1.3, EF + (0.1 - (5 - 5) \times (0.08 + (5 - 5) \times 0.02)))$.
- [ ] Implement `buildLearnerProfile` in `src/domain/profile.ts`:
  - Handle 0 sessions (`status: 'new'`), 1–2 sessions (`status: 'baseline'`), and 3+ sessions (`status: 'established'`).
  - Discount feedback issues flagged as `incorrect` by user rating, preventing false AI alerts from corrupting weakness rankings.
  - Compute directional averages, topic averages, and dimension trends using rolling windows.
- [ ] Export profile and spaced repetition helpers cleanly from domain modules.

---

### Task 2: Implement IndexedDB schema migration to v2 and storage extensions

**Files:**
- Modify: `src/storage/database.ts`

**Interfaces:**
```typescript
// src/storage/database.ts additions

export interface PracticeDBV2 extends DBSchema {
  settings: { key: string; value: unknown };
  sessions: { key: string; value: SessionRecord; indexes: { createdAt: string } };
  glossary: {
    key: string;
    value: GlossaryEntry;
    indexes: {
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      dueDate: string;
      createdAt: string;
    };
  };
  mistakes: {
    key: string;
    value: MistakeEntry;
    indexes: {
      sessionId: string;
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      dimension: string;
      dueDate: string;
      status: string;
    };
  };
  feedback_ratings: {
    key: string;
    value: FeedbackRating;
    indexes: {
      sessionId: string;
      rating: string;
    };
  };
  profile_cache: {
    key: string;
    value: { id: string; profile: LearnerProfile; updatedAt: string };
  };
}

export interface ExportBundleV2 {
  schemaVersion: 2;
  exportedAt: string;
  settings: LearnerSettings;
  sessions: SessionRecord[];
  glossary: GlossaryEntry[];
  mistakes: MistakeEntry[];
  feedbackRatings: FeedbackRating[];
}

export interface StorageBreakdown {
  sessionsCount: number;
  glossaryCount: number;
  mistakesCount: number;
  feedbackRatingsCount: number;
  dueReviewsCount: number;
  estimatedBytes: number;
}
```

- [ ] Bump IndexedDB version from 1 to 2 in `src/storage/database.ts`.
- [ ] Add `upgrade` migration handling:
  - If `oldVersion < 1`: create `settings` and `sessions` stores (preserving Phase 1 layout).
  - If `oldVersion < 2`: create `glossary`, `mistakes`, `feedback_ratings`, and `profile_cache` stores with their indexes.
  - Verify that existing Phase 1 sessions and settings are left untouched and accessible.
- [ ] Implement storage access methods:
  - `listGlossaryEntries(filter?: { languagePair?: string; dueOnly?: boolean }): Promise<GlossaryEntry[]>`
  - `saveGlossaryEntry(entry: GlossaryEntry): Promise<void>`
  - `deleteGlossaryEntry(id: string): Promise<void>`
  - `listMistakes(filter?: { status?: string; dimension?: string; dueOnly?: boolean }): Promise<MistakeEntry[]>`
  - `saveMistake(mistake: MistakeEntry): Promise<void>`
  - `deleteMistake(id: string): Promise<void>`
  - `saveFeedbackRating(rating: FeedbackRating): Promise<void>`
  - `listFeedbackRatings(sessionId?: string): Promise<FeedbackRating[]>`
  - `getCachedProfile(): Promise<LearnerProfile | null>`
  - `saveCachedProfile(profile: LearnerProfile): Promise<void>`
- [ ] Extend `exportData()` to compile `ExportBundleV2` containing all stores and excluding secrets.
- [ ] Extend `clearData(options?: { sessions?: boolean; glossary?: boolean; mistakes?: boolean; all?: boolean })` supporting granular deletion and confirmed full reset.
- [ ] Add `getStorageBreakdown(): Promise<StorageBreakdown>` for the settings inspector.

---

### Task 3: Build the weakness-driven recommendation and exercise generator engine

**Files:**
- Create: `src/domain/exercise-generator.ts`, `src/ai/generation-prompt.ts`
- Modify: `src/ai/provider.ts`, `src/ai/local-provider.ts`, `src/ai/cloud-provider.ts`

**Interfaces:**
```typescript
// src/domain/exercise-generator.ts

export interface ExerciseGenerationInput {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  targetDimension: RubricDimensionKey;
  errorType?: string;
  topic?: string;
  difficulty: 'catti3' | 'catti2' | 'catti1';
}

export interface ValidationSuccess<T> {
  isValid: true;
  data: T;
}

export interface ValidationFailure {
  isValid: false;
  errors: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function selectCatalogWeaknessExercise(
  catalog: Exercise[],
  profile: LearnerProfile,
  recentExerciseIds: string[]
): RecommendedDrill | null;

export function buildNotebookReconstructionDrill(
  mistake: MistakeEntry
): Exercise;

export function validateGeneratedExercise(
  candidate: unknown,
  expectedSourceLang: LanguageCode,
  expectedTargetLang: LanguageCode
): ValidationResult<Exercise>;

export function generatePersonalizedRecommendations(
  catalog: Exercise[],
  profile: LearnerProfile,
  dueReviews: { glossary: GlossaryEntry[]; mistakes: MistakeEntry[] },
  recentSessionIds: string[]
): RecommendedDrill[];
```

```typescript
// src/ai/generation-prompt.ts
export function buildExerciseGenerationPrompt(input: ExerciseGenerationInput): string;
```

```typescript
// src/ai/provider.ts additions
export interface GenerationProvider {
  generateDrill(input: ExerciseGenerationInput): Promise<Exercise>;
}
```

- [ ] Implement deterministic catalog selection in `src/domain/exercise-generator.ts`:
  - Calculate deficit score: $(100 - \text{averageDimensionScore}) \times \text{relevanceWeight}$.
  - Filter exercises in `src/data/exercises.ts` matching learner's weakest direction and dimension tags.
  - Apply recency penalty for exercises completed in the past 5 sessions to avoid repetition.
  - Return top-ranked catalog drill with explicit rationale (e.g. "Targets your recurring inaccuracy in economic collocations").
- [ ] Implement deterministic notebook reconstruction drill builder:
  - Take a saved `MistakeEntry`, create a targeted fill-in-the-blank or sentence revision exercise using the learner's own historical context.
  - 100% deterministic, zero LLM calls, zero network.
- [ ] Implement pre-display validation gatekeeper `validateGeneratedExercise`:
  - Schema check: verify non-empty `title`, `topic`, `difficulty`, `sourceText`, `referenceTranslation`.
  - Length check: source text must be between 15 and 80 words/tokens (focused micro-drill).
  - Script & character set verification using Unicode regexes:
    - Chinese (`\p{Script=Han}`), Arabic (`\p{Script=Arabic}`), Hindi (`\p{Script=Devanagari}`), Russian (`\p{Script=Cyrillic}`), English/French/Spanish (`\p{Script=Latin}`).
    - Reject if source or target language has $< 60\%$ expected script characters.
  - Repetition and entropy check: reject degenerate model output with looping tokens or extreme n-gram repetition.
  - Length ratio check: target-to-source length ratio must fall between $0.4$ and $3.0$.
- [ ] Implement `buildExerciseGenerationPrompt` in `src/ai/generation-prompt.ts`:
  - Enforce strict JSON output with specific field names and unambiguous linguistic guidance.
- [ ] Extend AI evaluation providers:
  - In `local-provider.ts`: call the local worker with generation prompt; return parsed JSON. If model is missing or fails validation, return clear failure without crashing.
  - In `cloud-provider.ts`: format OpenAI-compatible completion request. Include payload preview generator for user consent.
  - In `provider.ts`: if in local-only mode, block all network requests. If cloud fallback, require consent token before calling cloud provider. If generation fails validation, cleanly trigger fallback to catalog exercise.

---

### Task 4: Connect feedback signals, glossary management, and mistake notebook

**Files:**
- Modify: `src/features/practice/FeedbackPanel.tsx`, `src/features/practice/practice.css`
- Create: `src/features/review/GlossaryManager.tsx`, `src/features/review/MistakeNotebook.tsx`, `src/features/review/review.css`

**Interfaces:**
- `FeedbackPanel` exposes interactive inline actions on each issue:
  - `onRateIssue(issueIndex: number, rating: 'helpful' | 'incorrect')`
  - `onSaveGlossaryTerm(sourceTerm: string, targetTerm: string, tags: string[])`
  - `onSaveMistake(issue: TranslationIssue, userNote?: string)`
- `GlossaryManager`:
  - Renders responsive term list with search by term/tag, language pair filter, and due-status pill.
  - Modal/inline form to add, edit, or delete terms.
  - Directional script isolation (`dir="rtl"` for Arabic, `dir="ltr"` for others).
- `MistakeNotebook`:
  - Displays mistakes grouped by rubric dimension (Accuracy, Omission/Addition, Terminology, Grammar, Fluency/Style).
  - Shows original learner answer with highlighted error span and suggested revision.
  - Allows editing notes, toggling status (`active` / `mastered`), and launching a reconstruction drill.

- [ ] Update `FeedbackPanel.tsx`:
  - Add 👍 Helpful and 👎 Incorrect button toggles next to each rubric issue annotation.
  - Persist ratings via `database.saveFeedbackRating`.
  - When marked 👎 Incorrect, show visual indicator: "Noted as false positive — excluded from weakness tracking".
  - Add "Save Term to Glossary" button opening a prefilled modal (source word, suggested target word, language pair, tags).
  - Add "Save to Mistake Notebook" button saving source span, learner mistake, correction, dimension, and optional learner reflection.
- [ ] Create `src/features/review/GlossaryManager.tsx`:
  - Search input with instantaneous client-side filtering.
  - Language pair filter selector.
  - Term list card view for mobile; sortable table view for laptop.
  - Inline edit and delete buttons with confirmation.
  - "Add Custom Term" button with validation.
  - Badge showing spaced repetition due date / status (e.g. "Due today", "Review in 4 days").
- [ ] Create `src/features/review/MistakeNotebook.tsx`:
  - Rubric dimension filter tabs.
  - Expandable mistake cards showing source context, learner answer, suggested translation, and user note.
  - Action buttons: "Edit Note", "Mark Mastered", "Delete", and "Practice This Mistake".
  - Full bidirectional text rendering using `<bdi>` elements.
- [ ] Style the review components in `src/features/review/review.css` and update `src/features/practice/practice.css`.

---

### Task 5: Implement interactive spaced review session player with RTL support

**Files:**
- Create: `src/features/review/ReviewSession.tsx`, `src/features/review/Flashcard.tsx`
- Modify: `src/App.tsx`, `src/features/dashboard/Dashboard.tsx`

**Interfaces:**
- `ReviewSession`:
  - Loads due cards from both `glossary` and `mistakes` stores.
  - Shows session progress (e.g. "Card 3 of 12", remaining count).
  - Tracks completed reviews and updates IndexedDB with new `RepetitionState` after each rating.
  - Congratulatory completion screen with summary of reviewed items and upcoming schedule.
- `Flashcard`:
  - Front: term or source sentence with target prompt.
  - Back: translation, correction, grammatical notes, context, and error category.
  - Four grade buttons: Again (1), Hard (2), Good (3), Easy (4), each displaying dynamically computed interval preview (e.g. "1d", "3d", "6d", "12d").
  - Desktop keyboard controls: `Space` to flip, `1` for Again, `2` for Hard, `3` for Good, `4` for Easy.
  - Mobile touch controls: Tap to flip, large thumb-friendly grade buttons ($\ge 48\text{px}$ height).
  - RTL handling: Dynamically applies `dir="rtl"` to Arabic text and `dir="ltr"` to non-Arabic text on either face.

- [ ] Build `Flashcard.tsx`:
  - Two-state presentation (Question / Answer revealed).
  - Dynamic `dir` attribute determined by language script of the displayed content.
  - Display interval previews directly on each rating button computed via `formatIntervalPreview(state, grade)`.
- [ ] Build `ReviewSession.tsx`:
  - Query due items from database on mount: `getDueGlossaryEntries()` and `getDueMistakes()`.
  - Queue management: cards graded "Again" (1) return to the end of the current review queue for same-session consolidation.
  - Persist updated `RepetitionState` to IndexedDB upon card rating.
  - Keyboard listener for desktop shortcuts (`Space`, `1`, `2`, `3`, `4`).
  - Mobile swipe or tap-friendly layout.
  - Session finish state showing count of reviewed items, retention breakdown, and next review date.
- [ ] Update `src/features/dashboard/Dashboard.tsx`:
  - Display "Due Spaced Reviews" banner if due cards $> 0$ with one-click "Start Review" button.
  - Display "Recommended Weakness Drill" card showing the top-ranked recommendation from `generatePersonalizedRecommendations`.
- [ ] Add navigation targets in `src/App.tsx` for Spaced Review, Mistake Notebook, and Glossary views.

---

### Task 6: Build progress trends, graceful degradation, and extended data management

**Files:**
- Modify: `src/features/progress/ProgressPage.tsx`, `src/features/progress/progress.css`
- Modify: `src/features/settings/SettingsPage.tsx`, `src/features/settings/settings.css`
- Modify: `README.md`

**Interfaces:**
- `ProgressPage`:
  - State: computes `LearnerProfile` from `listSessions()` and `listFeedbackRatings()`.
  - Three distinct render modes based on session count:
    - **0 Sessions (New):** Clean onboarding state explaining the 5 CATTI/MTI dimensions and how error patterns are tracked. Zero charts, zero fake 0% bars, zero extrapolated trend lines.
    - **1–2 Sessions (Baseline):** Baseline performance summary card with actual scores achieved. Clear notice: *"Baseline established (N sessions). Trend analysis and weakness diagnostics unlock after 3 completed sessions."*
    - **3+ Sessions (Established):** Full interactive analytics: rolling 5-session average line graph, dimension radar/bar breakdown, weakest dimension alert, top recurring error chips with drill triggers, and language direction comparison.
  - All charts rendered with lightweight, accessible SVG/Canvas elements; no external graphing libraries.
- `SettingsPage`:
  - Data Storage Breakdown widget showing itemized counts: Sessions, Glossary Terms, Mistake Entries, Feedback Ratings, Estimated Storage.
  - Export Data button: triggers download of `catti-practice-export-YYYY-MM-DD.json` adhering to `ExportBundleV2`.
  - Clear Data modal: granular checkboxes (Clear Sessions, Clear Glossary, Clear Mistake Notebook, Clear All) with double confirmation.
- `README.md`:
  - Document personalized learning features, SM-2 implementation details, privacy safeguards, local-only rules, and schema v2 format.

- [ ] Implement graceful degradation in `ProgressPage.tsx`:
  - Detect `profile.status`:
    - If `'new'`: render welcoming guidance banner, checklist of rubric dimensions, and CTA to start first exercise.
    - If `'baseline'`: render score cards for existing sessions and explanation of required threshold for trend analysis.
    - If `'established'`: render rolling average trends, rubric dimension breakdown, recurring error breakdown, and targeted drill shortcuts.
- [ ] Build lightweight responsive SVG charts in `ProgressPage.tsx`:
  - Score trend timeline plotting actual session data points connected by line (never interpolating across days without sessions).
  - Horizontal dimension performance bars with 0–100 scale and color coding (green $\ge 80$, amber $60-79$, red $< 60$).
  - Error frequency pill list with counts and "Practice Drill" buttons.
- [ ] Update `SettingsPage.tsx`:
  - Add Storage Breakdown summary card calling `database.getStorageBreakdown()`.
  - Connect "Export All Data (v2 JSON)" download handler.
  - Connect "Manage & Clear Data" dialog with granular toggles and explicit confirmation text input (e.g. typing "DELETE").
- [ ] Verify right-to-left layout and responsive reflow across phone (375px) and laptop (1280px) widths for all newly added views.
- [ ] Document features, local storage guarantees, SM-2 algorithm justification, and model generation fallbacks in `README.md`.

---

## Research Notes

- **SuperMemo-2 (SM-2) Spaced Repetition Algorithm:**
  - Wozniak, P. A. (1990). *Optimization of learning*. Master's thesis, University of Technology in Poznań. Detailed specification and mathematical analysis at: <https://super-memory.com/english/ol/sm2.htm> and <https://www.supermemo.com/en/blog/application-of-a-computer-to-increase-the-productivity-of-learning>.
  - *Justification for SM-2 over Leitner and FSRS:* Leitner box systems (Leitner, 1972) use rigid, discrete buckets without continuous difficulty modeling. While the Free Spaced Repetition Scheduler (FSRS-4.5/5, Jarrett Ye, 2022–2024, <https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm>) offers state-of-the-art retrievability modeling for massive card decks, it relies on non-linear curve fitting with 17 tuned weights. For an offline-first browser app with individual candidate vocabularies (typically 100–1,000 terms), SM-2 provides an ideal balance: it is completely deterministic, requires zero external library dependencies, stores minimal $O(1)$ state per card (`repetitions`, `intervalDays`, `easinessFactor`, `dueDate`), computes in sub-microsecond time, and has 35 years of proven pedagogical validity for translation vocabulary retention.
- **IndexedDB Schema Versioning and Upgrades:**
  - MDN documentation on managing version upgrades via `onupgradeneeded` without data loss: <https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB#updating_the_version_of_the_database>.
  - Schema migration checks `oldVersion < 2` inside the transaction to create new object stores while preserving all existing `sessions` and `settings` data.
- **Bi-directional Text and RTL Support (Arabic):**
  - MDN documentation on bidirectional text isolation using the HTML `<bdi>` element: <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bdi>.
  - MDN CSS Logical Properties and Values specification: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values>.
  - Using `margin-inline`, `padding-inline`, and `dir="rtl"` ensures that mixed Arabic-Chinese or Arabic-English vocabulary cards do not suffer from reversed punctuation or scrambled alignment.
- **Small On-Device Language Model Realism & Fallback Rationale:**
  - MLC-AI WebLLM documentation and benchmarks: <https://github.com/mlc-ai/web-llm>.
  - Qwen3 Multilingual Technical Report: <https://qwenlm.github.io/blog/qwen3/>.
  - *Honest assessment of 1.7B on-device models:* A quantized 1.7B model running in-browser via WebGPU performs acceptably for short feedback classification, but struggles significantly with *synthetic bilingual exercise generation*, particularly for cross-script and lower-resource pairs (e.g. Chinese $\leftrightarrow$ Hindi, Chinese $\leftrightarrow$ Russian, and Chinese $\leftrightarrow$ Arabic). Common failure modes include unidiomatic collocations in the source text, syntactically flawed reference translations, looping token hallucinations, and inconsistent lexical constraints.
  - *Engineered Fallbacks:*
    1. The primary weakness-driven practice path is **deterministic selection from the authored catalog** (`src/data/exercises.ts`), which requires zero network and zero AI compute.
    2. The secondary practice path is **notebook reconstruction drills**, deterministically assembled from the learner's own verified mistake sentences.
    3. Model-generated drills are treated as an optional experimental tier. All candidate outputs must pass strict pre-display linguistic validation (script regex check, length ratio test, token entropy verification). If any check fails, the app discards the generation and falls back seamlessly to catalog drills without disrupting the learner.
- **CATTI / MTI Error Classification Framework:**
  - China Accreditation Test for Translators and Interpreters (CATTI) official syllabus and assessment guidelines: <http://www.catticenter.com/>.
  - Rubric alignment focuses on the five standard exam evaluation criteria: accuracy/meaning transfer, completeness (omissions/additions), terminology, grammar/collocations, and register/style.

---

## Handoff Notes

- **Sibling session compatibility:** This plan modifies existing domain and storage files strictly through extension (adding new types, stores, and functions) without altering Phase 1 function signatures or component hierarchies.
- **Offline independence:** Phase 4 can be developed, tested, and used completely offline. The local recommendation engine and spaced review scheduler require zero external network connectivity.
- **Cloud privacy guarantee:** Any cloud generation request must be preceded by an explicit consent dialog displaying the exact prompt payload. No background network calls or analytics telemetry are permitted.

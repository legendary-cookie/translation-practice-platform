# Changelog

## 0.2.0 — 2026-11-10 (QA)

- Focus the trainer on CATTI Level 3 and Chinese ↔ English / Chinese ↔ Russian.
- Remove MTI and CATTI Level 2.
- Replace the short practice snippets with 20 original CATTI 3-style passages (news, report, culture and science texts in 4–6 paragraphs), each with a paragraph-aligned reference translation (参考译文).
- Add an offline check that needs no AI: paragraph count, figures (handles 万/亿/万亿, млн/тыс, ranges, decimal commas), key terms, length, and rough similarity to the reference, with a side-by-side Source / Your translation / Reference table.
- Add provisional CATTI 3 exam profiles for English ↔ Chinese and Russian ↔ Chinese. By default the exam report shows the offline check and reference translations, so no AI is needed; AI feedback is an optional tick box when submitting.
- Remove obsolete language assets, exam variants and practice-level selectors; safely fall back from old preferences.
- Refresh the README and user guide screenshots and the captioned walkthrough video for the new version.

## 0.1.1 — 2026-10-16 (QA)

- Fix an Android WebView speech-capability probe that could terminate interpreting.
- Improve route focus, confirmation dialogs, exam passage keyboard navigation, source scrolling and contrast.
- Add English/Chinese accessibility checks and an isolated physical-phone QA variant.
- Use Qwen3.5 4B with WebLLM 0.2.85, constrained written feedback, source coverage and literal evidence IDs. Smaller tested models did not meet the basic check.
- Verify physical-phone drafts, lifecycle, Chinese interface and local microphone save/replay/deletion.
- Document observed reader output, TalkBack formatting announcements and qualification limits.
- Resolve PR follow-up for interrupted deletion, consistent exports, audio import limits, unsaved interpreting confirmation, stale-tab starts, cloud URL/key normalization, active review dates and dark report readability.
- Explicitly prepare the Electron binary during Windows packaging for clean CI installs.
- Keep lazy cache writes alive, avoid the AI runtime on first-launch capability checks, make exam evaluation progress accessible and report partial preference-reset failures with a retry.

Windows packages are unsigned and Android packages are debug-signed. Android local AI remains gated. Model scores remain fallible practice estimates.

# Changelog

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

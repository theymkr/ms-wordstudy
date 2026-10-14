# Mobile history verification — 2026-10-14

Baseline: `143aa05`, including the separate import-language fix after `8bd9667`.
No open PRs were returned when this work started. Only history presentation,
its build hook, and history tests are changed. No account records or learning
data were read or written in production.

## Findings and fixes

- The built history screen had no weekly query control. Added Monday–Sunday
  week selection using Asia/Seoul dates, combined with the existing exam-mode
  filter. Default is all dates, including September and October. Original
  attempt numbers and wrong-word snapshots are retained.
- The previous graph scaled every attempt into the phone width, shrinking labels
  as history grew. A keyboard-focusable horizontal scroll region now retains
  native-size graph labels. Short screens scroll the history panel vertically.
- No September/October cutoff exists in `readScores` or the history renderer.
  This verifies supported fixture data, not completeness of a user's cloud or
  device records. Imported-book histories remain scoped to their existing keys.

## Validation

- `npm run build`
- `node tests/history-layout.cjs` (Playwright Chromium; executable override used
  because the standard browser CDN download failed in this environment).
- Viewports: 320×568, 375×667, 390×844, 430×932, 768×1024, 1280×800.
- Korean Noto Sans KR font used for layout and screenshot inspection.
- 122 September/October fixtures: every ID reachable, reverse chronology of
  stored attempts preserved, previous/next boundaries, more than 100 records.
- KST Sunday 23:59:59 / Monday 00:00:00 week boundary, September/October weeks,
  combined listen/meaning filters, graph point counts, horizontal scrolling.
- Per-attempt wrong-word preview identity, print invocation, legacy score-only
  alert (no fabricated wrong-word list), empty history.
- Score storage is byte-for-byte unchanged after browsing and filtering.

The test removes cloud authentication and blocks external requests. Actual
iPhone Safari, live-account sync/completeness, OS print dialogs, and physical
printing are not verified by this suite. No production deployment is performed
as part of this verification branch.

Optional test environment variables: `BROWSER`, `PLAYWRIGHT_PATH`,
`BROWSER_EXECUTABLE`, `HISTORY_FONT_CSS` (local Fontsource CSS),
`HISTORY_SCREENSHOT`.

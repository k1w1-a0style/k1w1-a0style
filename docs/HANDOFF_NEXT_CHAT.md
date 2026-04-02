# Next-Chat Handoff

Stand: **2026-04-02 (Docs Konsolidierung)**

Diese Datei ist bewusst nur eine **kleine Startvorlage** fuer einen neuen Chat.

## Minimaler Startprompt

- Repo: `k1w1-a0style`
- Lies zuerst: `docs/INDEX.md`, `docs/00-overview.md`, `docs/reviews/Review.md`, `docs/TODO.md`
- Danach nur die **wirklich betroffenen** Fach-/Runbook-Dokumente oeffnen
- Keine Broad-Refactors ohne konkreten Befund
- Nach Aenderungen mindestens: `npm run typecheck:strict`, `npm run docs:lint`, `npm run docs:check:contracts`
- Fuer Release-/Operator-Faelle zusaetzlich: `npm run verify:release`

## Was nicht hierher gehoert

- alte Patch-Historie
- alte Review-Zusammenfassungen
- erledigte TODOs
- historische Statusberichte

Dafuer gelten:
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/reviews/Review.md`

# Next-Chat Handoff (copy/paste)

Stand: **2026-02-10** (Europe/Berlin)

## Repo
- https://github.com/k1w1-a0style/k1w1-a0style

## Status
- **CodeScreen**: Fix-Serie ist funktional „fertig“.
  - WebView-Editor Bridge stabilisiert
  - Injection-Härtung
  - Focus-Tracking + stabiler RN↔WebView Sync
  - `isDirty` vereinheitlicht (Hook + UI, inkl. Preview)
  - TXT-Export robust (expo-file-system typings kompatibel)
  - QoL: Duplicate-Kollisionen, Dateiendung-Regeln, Clipboard-Fehlerhandling, stabile Keys für SyntaxErrorBar

## Offene Punkte
### CodeScreen (optional / Tech-Debt)
- `useCodeScreen` ist sehr groß („God Hook“) → später in kleinere Hooks splitten.
- TS-Cleanup: `gap` typisieren (global `.d.ts`) statt `as any`.
- expo-file-system Typings ggf. sauber via `.d.ts` statt `any`.
- Performance: Syntax-Validation bei sehr großen Dateien ggf. noch aggressiver skippen / auslagern.

### Nächster kompletter Screen
- **PreviewScreen** (danach PreviewFullscreen).

## Patch-Workflow
```bash
unzip -o <PATCH>.zip -d .
rm -f <PATCH>.zip

npm run typecheck
npm run lint:ci
npm run test:silent

git add -A
git commit -m "<message>"
git push

git status
```

## Docs, die immer gepflegt werden
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
- `docs/WORKFLOW_PATCHING.md`

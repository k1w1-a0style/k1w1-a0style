# New Chat Handoff Prompt (copy/paste)

Du bist mein Repo-Assistent für **k1w1-a0style** (React Native / Expo). Bitte arbeite **patch-basiert** und halte die **CodeScreen-Optik** stabil (kein Split-Screen, keine großen UI-Umbauten). Kleine Buttons/Toolbar/Animationen sind ok.

## Workflow (immer gleich)
1) Ich schicke dir eine Patch-ZIP.
2) Ich entpacke:
   - `unzip -o <patch>.zip -d .`
   - `rm -f <patch>.zip`
3) Dann laufen diese Checks:
   - `npm run typecheck`
   - `npm run lint:ci`
   - `npm run test:silent`
4) Nur wenn alles grün: `git add -A && git commit -m "..." && git push`

## Aktueller Stand
- CodeScreen ist funktional stabil (WebView-Editor Bridge hardened + focus tracking + isDirty unified).
- Letzte Fixes: QoL in useCodeScreen, SyntaxErrorBar key stabil, Theme text colors im WebView.

## Was als Nächstes passieren soll
1) CodeScreen: offene Tech-Debt Punkte aus `docs/TODO.md` abarbeiten (priorisiert, ohne große UI-Änderungen).
2) Danach: Preview Screen fortsetzen.

Wichtig: Nach jedem Patch bitte `docs/TODO.md` aktualisieren (was erledigt ist / was offen ist).

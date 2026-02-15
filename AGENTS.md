# Agent Instructions (Deutsch, Codex/Cloud-Agent freundlich)

Du arbeitest in diesem Repo als automatisierter Coding-Agent.
Ziel: **kleine, sichere Änderungen**, reproduzierbar, mit Tests.

## Goldene Regeln

1. **Arbeite in kleinen Commits**: erst minimale Änderung → Tests → dann nächste.
2. **Keine Überraschungen**: keine Dependencies updaten, keine Format-Wipes ohne Grund.
3. **Immer checken**: Typecheck + Lint + Tests müssen grün sein.
4. **Security & Secrets**: niemals Tokens/Keys loggen oder in Dateien schreiben.
5. **Erkläre kurz**: Was geändert, warum, wie testen.

## Standard-Workflow

1. Code lesen & Kontext verstehen (`PROJECT_CONTEXT.md`, `SYSTEM_README.md`).
2. Änderung umsetzen.
3. Lokale Checks laufen lassen:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Patch-ZIP Workflow (so arbeiten wir hier)

Wir liefern Änderungen als **Patch-ZIP** aus, damit sie lokal im Projekt-Root entpackt werden können.

- ZIP-Name: `k1w1-a0style_patch_<PATCHNUM>.zip`
- Inhalt: **nur** geänderte/neue Files (keine kompletten Repo-Dumps)
- Anwendung:

```bash
unzip -o k1w1-a0style_patch_<PATCHNUM>.zip -d .
rm -f k1w1-a0style_patch_<PATCHNUM>.zip

npm run typecheck
npm run lint:ci
npm run test:silent

git add -A
git commit -m "Patch <PATCHNUM>: <kurzer Titel>"
git push origin main
```

Jeder Patch aktualisiert:
- `docs/patches/patch_<PATCHNUM>.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
- ggf. `README.md` / `docs/TODO.md` (wenn relevant)

## Cleanup

- Backup-/Rest-Dateien (z.B. `*.bak*`, `*.orig`, `*.rej`, `*~`) nicht im Repo lassen – bei Bedarf entfernen.

## UI Style-Konventionen

- **Neon Giftgrün + Dark** als Default-Look (`theme.palette.primary` als Akzent)
- **SEHR WICHTIG: Selection-Feedback überall**
  - Ausgewähltes **Repo/Branch/Profile** muss *überall* übernommen werden (Single Source: `projectData.linked*`).
  - Listen/Buttons zeigen **Glow/Rand/Lamp** für ausgewählte Items (kein Rätselraten).
- **Status-Lämpchen**: grau = unknown/waiting, grün = OK, rot = Error, pulsierend = running
- **Running-Feedback**: dezente Animation (Pulse/3-Punkte/Spinner), nicht zu noisy

## Qualität

- Halte Funktionen klein.
- Bevorzugt pure Functions in `lib/` und helper in `utils/`.
- UI: konsistente Styles (siehe `styles/`).

## Wenn etwas unklar ist

- Erst Code + Docs durchsuchen.
- Dann eine Hypothese formulieren und minimal testen.


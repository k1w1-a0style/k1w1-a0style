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

## Qualität

- Halte Funktionen klein.
- Bevorzugt pure Functions in `lib/` und helper in `utils/`.
- UI: konsistente Styles (siehe `styles/`).

## Wenn etwas unklar ist

- Erst Code + Docs durchsuchen.
- Dann eine Hypothese formulieren und minimal testen.


# Patch 626 — Kleiner Cleanup-/Hardening-Nachzug (Restpunkte)

## Ziel

Enger, evidenzbasierter Restpunkt-Durchlauf ohne Broad-Cleanup:

1. Doku-SoT zwischen `docs/TODO.md` und `docs/PROJECT_TODO.md` klarziehen.
2. Offenen CS-REST-001-Status ehrlich finalisieren (kein erneuter Produktumbau).
3. Naechsten kleinen Runtime-`as any`-Hotspot selektiv abbauen.

## Umsetzung

- `docs/PROJECT_TODO.md` ist jetzt explizit als **historische** Liste markiert; aktive operative Restpunkte bleiben in `docs/TODO.md`.
- `docs/TODO.md` markiert `CS-REST-001` als geschlossen und dokumentiert den bereits vorhandenen Busy-Guard-/Feedback-Stand fuer `testEas`.
- `lib/secretRedaction.ts` entfernt den verbleibenden Runtime-`as any`-Cast in `replaceAllSafe(...)`; `String.replace` bleibt verhaltensgleich, der Typvertrag ist enger.
- `docs/04-risk-hotspots.md` zieht die offene Any-Priorisierung nach (`secretRedaction` nicht mehr offen).
- `README.md`, `docs/INDEX.md`, `PROJECT_CHECKLOG.md` und `docs/patches/PATCHLOG_ROOT.md` auf denselben Patchstand synchronisiert.

## Verifikation

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
npm run test:silent -- --runInBand __tests__/terminalSecretRedaction.test.ts __tests__/connectionsScreen.flowGuards.invariants.test.ts
git diff --check
bash scripts/check_patch_docs_sync.sh
```

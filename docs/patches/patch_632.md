# Patch 632 — `as any`-Abbau (Durchlauf 6, Script-Generator-Reste)

## Ziel
Sechster Durchlauf: letzte verbleibende `as any`-Fragmente in nicht-produktivem, aber codegenerierendem UI-Script-Scope entfernen.

## Umgesetzt
1. `scripts/ui/k1w1_ui_polish_templates.sh`
   - generierter TS-String nutzt `as unknown` statt `as any` fuer `templateId`.

2. `scripts/ui/apply_ui_polish_fix_dev_toggle_v2.sh`
   - Regex-Rewrite injiziert keinen `as any`-Cast mehr fuer `projectData?.files`.

## Inventar
- Codefokussierter Scan (ohne `docs/**` und `README.md`):
  - Vorher: 167
  - Nachher: 165
  - Netto: **-2 `as any`**

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts`
- `git diff --check`

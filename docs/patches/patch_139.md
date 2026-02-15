# Patch 139 — CI Lite: robust workflow + Apply Patch panel

## Änderungen

- GitHub Actions: CI Lite nutzt jetzt Fallbacks, falls `npm run lint:ci` oder `npm run typecheck` fehlt:
  - `npx eslint . --quiet`
  - `npx tsc --noEmit`
- CI Lite speichert außerdem `ci-logs/lint.log` und `ci-logs/typecheck.log` als Artifact (`ci-lite-logs`, 7 Tage).
- In-App CI Lite Modal: neues Panel **Apply Patch (JSON)** mit `Paste`, `Validate`, `Apply`.

## Verifikation

1. App öffnen → globaler ✅ Button → CI Lite auslösen
2. Logs prüfen / kopieren
3. Optional: Patch JSON von der KI einfügen → `Validate` → `Apply` → CI Lite erneut auslösen

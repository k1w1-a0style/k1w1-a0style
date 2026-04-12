# Patch 775: StartupEdgeHintSoftening

## Scope

Gezielter UX-Korrekturpass auf Patch 774:
- fehlende Edge-URL weiterhin erkennen und loggen
- keine prominente Warnwirkung im Boot-/Loading-Flow
- kleiner, nicht-blockierender Hinweis in einem passenden Konfigurationsbereich

## Aenderungen

- `App.tsx`
  - Startup-Check fuer fehlende Edge-URL bleibt aktiv.
  - Kein sichtbarer Warning-Text mehr im Loading-Screen.
  - Logging bleibt non-blocking fuer Diagnose.
  - Loading-Timeout-Hinweis (20s) bleibt unveraendert.
- `screens/ConnectionsScreen/components/SupabaseCard.tsx`
  - Neuer kleiner, unaufdringlicher Hinweistext bei leerer Supabase-URL.
  - Kein Modal/Alert/Blocker, ignorierbar und spaeter konfigurierbar.
- `__tests__/connectionsScreen.supabaseHint.test.tsx`
  - Deckt Sichtbarkeit/Unsichtbarkeit des Hinweises ab (leer vs. gesetzt).

## Nicht geaendert (bewusst)

- Keine Ruecknahme von Patch-774-Security-Teilen:
  - `libsodium-wrappers-sumo` Crypto-Migration
  - `signing_android` Policy-Praezisierung
  - `search_path`-Hardening
- Keine Aenderung an bestehenden RBAC-/verify_jwt-/Allowlist-Vertraegen.

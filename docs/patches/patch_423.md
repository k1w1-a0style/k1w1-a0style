# Patch 423 – Expo-Web/QR-Preview Machbarkeits-Audit (ohne Umbau)

## Ziel

Konservative, technische Machbarkeitsprüfung für Expo Web / QR-Web-Preview als offizieller Preview-Modus.
Keine Architektur-Implementierung, kein Broad Refactor.

## Änderungen

- Neues Audit-Dokument erstellt: `docs/expo_web_qr_preview_feasibility.md`.
- Enthält:
  - Ist-Analyse (Entry, Expo-Config, Navigation, Preview-Pfade)
  - Hürden/Blocker für Expo Web als sofortiger offizieller Modus
  - Vergleich mit vorhandenem Supabase-/Local-Fallback-Preview
  - klare Entscheidung (B) + minimale Vorarbeiten

## Entscheidung

- **B:** Expo Web / QR-Web-Preview ist sinnvoll, aber erst nach gezielten Vorarbeiten.
- Kurzfristig ist der bestehende browserfähige Supabase-Preview-URL-Weg realistischer als ein sofortiger Expo-Web-Hauptmodus.

## Verifikation

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

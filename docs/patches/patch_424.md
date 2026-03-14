# Patch 424 – Supabase Preview als offizieller Browser-/QR-Preview-Weg geschärft

## Ziel

Bestehenden Supabase-Preview-Flow produktseitig klar als bevorzugten visuellen Browser-/WebView-Weg markieren,
inkl. besserer URL-/Expiry-/Fallback-Kommunikation und leichter QR-Aktion – ohne neue Preview-Architektur.

## Änderungen

- `PreviewScreen` UX gezielt geschärft:
  - Toolbar nennt explizit den bevorzugten Browser-Preview-Weg über Supabase.
  - Statusbereich zeigt Kanal + Ablaufstatus (Expiry) verständlich an.
  - URL-Karte ergänzt: offizieller Preview-Link + Aktionen (kopieren, extern öffnen, QR anzeigen, QR-Link kopieren).
- `usePreviewScreen` erweitert um abgeleitete Produktinfos (`previewChannelLabel`, `previewExpiryText`) und QR-Link-Aktionen.
- `hooks/previewHelpers.ts` um kleine pure Helper ergänzt:
  - Ablauftext-Formatierung
  - Kanal-Labeling (Supabase bevorzugt vs. technischer Fallback)
  - QR-Bild-URL-Generator für vorhandene Preview-URL
- Regressionstest ergänzt: `__tests__/previewHelpers.test.ts`.

## Warum minimal

- Kein Umbau der Preview-Architektur.
- Kein Expo-Web-Einstieg, keine neue Plattform.
- Bestehender Supabase-Flow bleibt unverändert und wird nur im Produkt klarer kommuniziert.

## Verifikation

- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

# Patch 423 – Preview-Flow SoT-Härtung (2 reale Modi klar geführt)

## Ziel
Bestehenden Preview-Flow minimal härten: nur real unterstützte Modi (Supabase + Local HTML) klar als Vertrag führen, Fallback transparent machen und screen-übergreifenden Kontext angleichen.

## Änderungen
- Projektweiter `preferredPreviewMode` eingeführt (`supabase | local`) inkl. Context-Setter.
- Zentralen Resolver `resolvePreviewModeForStart` ergänzt.
- `usePreview` nutzt den Resolver und persistiert die gewählte Präferenz; Supabase wird nur bei entsprechender Präferenz aktiv versucht.
- Preview-Ergebnis enthält jetzt auch den angefragten Modus (`requestedMode`), um Fallback (`requested != source`) transparent zu machen.
- PreviewScreen-Statusbar zeigt aktiven Modus, Präferenz und Fallback-Status.
- Fullscreen erhält `source/requestedMode` und zeigt Modus/Fallback konsistent im Header.
- Regressionstest für `resolvePreviewModeForStart` ergänzt.

## Verifikation
- typecheck, lint, test:silent
- Workflow-/Drift-/Patch-Sync-Skripte laut Auftrag

# Patch 736: Preview-Secret Fragment-Handoff statt Query-Secret

## Kontext / Root Cause

Der bisherige Standardpfad lieferte Preview-Links als `preview_page?secret=...`.
Das funktionierte, leakte das Secret aber unnötig über Browser-History, Copy/Paste und potenzielle URL-Logs.

## Zielbild

- **Minimal-invasive Härtung** ohne großen Umbau.
- Bestehende `preview_page`-UX (HTML-Error-Pfade, Expiry/Delete, Toggle-Links, XSS-Schutz) erhalten.
- Alte Links (`?secret=...`) nicht hart brechen.

## Umsetzung

1. `save_preview` erzeugt neue URLs jetzt als:
   - `.../preview_page?transport=fragment#secret=<token>`
2. `preview_page` unterstützt im Fragment-Modus (`transport=fragment`) ein Bootstrap-Handoff:
   - Erstaufruf ohne Query-Secret liefert eine kleine Bootstrap-Seite.
   - Client liest `#secret=...` aus Fragment, entfernt Fragment aus der sichtbaren URL und lädt die eigentliche Seite per Header `x-k1w1-preview-secret`.
3. Toggle-Links (`logs`, `runtime_errors`) bleiben im Fragment-Modus funktionsfähig und tragen das Secret weiterhin im Fragment statt im Query-String.
4. Legacy-Kompatibilität bleibt:
   - Vorhandene `?secret=...`-Links funktionieren unverändert.

## Sicherheit / Trade-offs

- **Verbessert:** Secret ist im neuen Standardpfad nicht mehr Teil des normalen Query-Strings.
- **Rest-Risiko:** Das Fragment bleibt natürlich im lokalen Browser-Kontext sichtbar, bis es entfernt wurde; alte Query-Links bleiben aus Kompatibilität aktiv.
- **Bewusst nicht gemacht:** kompletter Architekturumbau (z. B. neue DB-Token-Exchange-Route), um Scope klein und risikoarm zu halten.

## Tests

- `__tests__/previewEdgeErrorContract.test.ts` um Contract-Invariant für Fragment-/Header-Transport ergänzt.

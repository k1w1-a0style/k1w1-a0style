# Patch 562 — Preview-Vertrag fail-closed auf Remote, lokaler Fallback nur explizit

## Ziel
Den Preview-Produktvertrag ohne Architekturumbau ehrlich nachschaerfen:

1. Remote-/Server-Preview bleibt produktiver Standardpfad (SoT)
2. Bei Remote-Fehlern kein stiller Auto-Wechsel auf lokalen HTML-/Eval-Fallback
3. `preferredPreviewMode` wird nicht mehr implizit auf `local` befoerdert
4. Lokaler Fallback bleibt nur expliziter Local-/Dev-Pfad

## Umsetzung

### 1) `usePreview`: fail-closed fuer Produktpfad
- `createPreview()` faellt bei Remote-Problemen im normalen `supabase`-Modus **nicht** mehr still auf lokalen Fallback um.
- Stattdessen wird ein ehrlicher Fehler gesetzt/geworfen:
  - `Remote-Preview nicht verfuegbar. Lokaler HTML-/Eval-Fallback ist nur im expliziten Local-/Dev-Modus erlaubt.`
- Die bereits bestehende `remoteFailure`-Diagnose bleibt als Ursachenhinweis erhalten.

### 2) `usePreview`: lokaler Fallback nur noch explizit
- Neue explizite Modus-Logik ueber Helper (`shouldUseLocalPreviewFallback(...)`):
  - nur `preferredPreviewMode === "local"` darf lokalen HTML-/Eval-Fallback bauen.
- Kein allgemeiner Recovery-Fallback mehr fuer Remote-Ausfaelle im Produktpfad.

### 3) `preferredPreviewMode`: keine stille Promotion auf `local`
- Die bisherige Nebenwirkung `setPreferredPreviewMode("local")` nach lokalem Fallback wurde entfernt.
- `local` bleibt damit eine bewusste Nutzer-/Dev-Entscheidung statt Fehler-Nebeneffekt.

### 4) UI-/Textwahrheit fuer lokalen Eval-Pfad nachgezogen
- `lib/sandpackBuilder.ts` benennt den lokalen Pfad explizit als
  - nur im expliziten Local-/Dev-Modus,
  - nicht server-verifiziert,
  - Best-Effort.
- `usePreviewScreen`-Channel-Label kommuniziert denselben Vertrag.

## Tests
- `__tests__/usePreview.serverContract.test.tsx`
  - Remote-Fehler bleiben im Supabase-Produktpfad fail-closed (kein lokaler Auto-Fallback)
  - Admin-Key-/Filter-Fehler kippen nicht still auf lokalen Eval-Pfad
  - expliziter `preferredPreviewMode: "local"` behaelt den lokalen Dev-Fallback
  - kein implizites `setPreferredPreviewMode("local")`
- `__tests__/previewHelpers.test.ts`
  - explizite Helper-Semantik fuer lokalen Opt-in (`shouldUseLocalPreviewFallback`)
- `__tests__/previewStatusBar.statusText.test.ts`
  - bestehende ehrliche Fallback-/Status-Semantik bleibt konsistent

## Ehrliche Grenzen
- Der lokale HTML-/Eval-Fallback existiert weiterhin technisch (inkl. `new Function(...)`) und bleibt bewusst Dev-/Best-Effort.
- Dieser Patch entfernt den lokalen Fallback **nicht**, sondern verhindert dessen stille Produktpfad-Promotion.

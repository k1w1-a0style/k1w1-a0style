# Patch 239 (2026-02-23)

## Ziel

Stability-Sweep basierend auf dem vollständigen Review:

- Keine **silent drops** mehr bei neuen Dateien (FileWriter).
- `build.js` entfernen (war technisch nicht lauffähig, da `dist/` nicht erzeugt wird).
- Legacy-`require()` Monkey-Patch in `rotateApiKeyOnError` entfernen.
- `console.*` in sensiblen Flows durch `logger.*` ersetzen.
- Groq: Modell-Normalisierung mit **Fallback** (Prefix `groq/` → ohne Prefix) bei „model not found“.

## Änderungen

### 1) FileWriter: neue Dateien nicht mehr „wegschlucken“

- Vorher: neue (Code-)Dateien wurden bei fehlender Referenz **übersprungen**.
- Jetzt: Datei wird **übernommen**, aber es wird eine **Warnung** in `errors[]` ergänzt.

Datei:
- `lib/fileWriter.ts`

### 2) `build.js` entschärft (deaktiviert)

- Script war auf `./dist/...` verdrahtet, aber das Projekt emittiert kein `dist/`.
- Statt „kaputt“ ist es jetzt ein **Stub**, der klar sagt, dass es deaktiviert ist.

Datei:
- `build.js` (stub/deaktiviert)

### 3) `rotateApiKeyOnError`: require() raus

- Nutzt jetzt den bestehenden statischen Import von `SecureKeyManager`.

Datei:
- `contexts/AIContext.tsx`

### 4) console → logger (gezielt)

Dateien:
- `project/services/buildStartService.ts`
- `contexts/ProjectContext.tsx`

### 5) Groq Model-Fallback

- Wenn `model` mit `groq/` prefixed ist und die API „model not found“ liefert,
  wird automatisch ein zweiter Request mit dem Model **ohne Prefix** versucht.

Datei:
- `lib/orchestrator.ts`

## Checks

```bash
npm run test:silent
npm run typecheck
npm run lint:ci
```

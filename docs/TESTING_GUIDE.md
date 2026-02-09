# Testing Guide - Preview Refactoring

## Schritt-für-Schritt Anleitung zum lokalen Testen

### 1. Voraussetzungen prüfen

```bash
# Node.js Version prüfen (sollte >= 20.0.0 sein)
node --version

# npm Version prüfen (sollte >= 10.0.0 sein)
npm --version
```

---

### 2. Dependencies installieren

```bash
cd /vercel/sandbox
npm install
```

**Erwartetes Ergebnis:**

- Installation erfolgreich
- Keine kritischen Fehler
- `postinstall` und `prepare` Hooks laufen durch

---

### 3. TypeScript Type Checking

```bash
npm run typecheck
```

**Erwartetes Ergebnis:**

```
> tsc --noEmit
```

- Keine Fehler
- Exit Code: 0

**Bei Fehlern:**

- Prüfe ob alle neuen Dateien korrekt importiert sind
- Prüfe `types/preview.ts` auf Syntax-Fehler

---

### 4. ESLint Linting (CI Mode)

```bash
npm run lint:ci
```

**Erwartetes Ergebnis:**

```
> eslint . --quiet
```

- Keine Warnings/Errors
- Exit Code: 0

**Bei Fehlern:**

- Prüfe Code-Style in neuen Dateien
- Führe `npm run lint` aus für detaillierte Ausgabe

---

### 5. Jest Tests (Silent Mode)

```bash
npm run test:silent
```

**Erwartetes Ergebnis:**

```
Test Suites: 18 passed, 18 total
Tests:       3 skipped, 355 passed, 358 total
```

- Alle Tests grün
- Exit Code: 0

**Bei Fehlern:**

- Führe `npm run test:verbose` aus für Details
- Prüfe ob neue Imports korrekt sind

---

### 6. Alle Checks auf einmal

```bash
npm run typecheck && npm run lint:ci && npm run test:silent
```

**Erwartetes Ergebnis:**

- Alle drei Commands erfolgreich
- Keine Fehler

---

### 7. App starten (optional)

```bash
npm start
```

**Erwartetes Ergebnis:**

- Expo Dev Server startet
- QR Code wird angezeigt
- Keine Compile-Fehler

---

### 8. Funktionale Tests (in der App)

#### 8.1 Preview erstellen

1. Öffne die App (Expo Go oder Dev Build)
2. Navigiere zu **"Preview"** im Drawer-Menü
3. Klicke auf **"Neu erstellen"**

**Erwartetes Ergebnis:**

- Button zeigt "Erstelle…" während der Erstellung
- Preview öffnet sich automatisch im Fullscreen
- Kein Browser-Wechsel
- Sandpack lädt im WebView

#### 8.2 Preview Fullscreen

1. Im Fullscreen solltest du sehen:
   - Header mit Projekt-Name
   - "Local HTML Preview" als Subtitle
   - Toolbar mit Buttons: ◀ ▶ 📤 ↻
   - WebView mit Sandpack-Inhalt

**Erwartetes Ergebnis:**

- WebView lädt Sandpack
- Spinner verschwindet nach ~1-2 Sekunden
- Preview ist interaktiv

#### 8.3 Navigation testen

1. Klicke **"← Zurück"** im Header
2. Du solltest zurück zum PreviewScreen kommen
3. Klicke **"⛶ Vollbild öffnen"**
4. Preview sollte wieder im Fullscreen öffnen

**Erwartetes Ergebnis:**

- Navigation funktioniert
- Letzte Preview wird wiederverwendet
- Keine Fehler

#### 8.4 HTML kopieren

1. Im PreviewScreen, klicke **📋** Button
2. Alert sollte erscheinen: "Kopiert"

**Erwartetes Ergebnis:**

- HTML in Zwischenablage
- Alert erscheint

---

### 9. Supabase Edge Functions testen (optional)

**Nur wenn du Supabase Preview nutzen willst:**

#### 9.1 Secrets setzen

Via Dashboard:

1. Gehe zu: https://supabase.com/dashboard/project/<your-project>/settings/functions
2. Setze Secrets:
   - `PREVIEW_SUPABASE_URL`
   - `PREVIEW_SERVICE_ROLE_KEY`

Via CLI:

```bash
supabase secrets set PREVIEW_SUPABASE_URL=https://<your-ref>.supabase.co
supabase secrets set PREVIEW_SERVICE_ROLE_KEY=<your-service-role-key>
```

#### 9.2 Functions deployen

```bash
cd supabase
supabase functions deploy save_preview
supabase functions deploy preview_page
```

#### 9.3 Testen

```bash
# Test save_preview
curl -X POST https://<your-ref>.supabase.co/functions/v1/save_preview \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Preview",
    "files": {
      "/App.tsx": {"contents": "export default function App() { return <div>Test</div>; }"}
    }
  }'
```

**Erwartetes Ergebnis:**

```json
{
  "ok": true,
  "previewId": "...",
  "previewUrl": "https://.../functions/v1/preview_page?secret=...",
  "expiresAt": "..."
}
```

```bash
# Test preview_page (nutze previewUrl aus obiger Response)
curl "https://<your-ref>.supabase.co/functions/v1/preview_page?secret=<secret>"
```

**Erwartetes Ergebnis:**

- HTML Seite mit Sandpack
- Status 200
- Kein 404 Error

---

## Troubleshooting

### Problem: TypeScript Fehler

**Symptom:** `tsc --noEmit` zeigt Fehler

**Lösung:**

1. Prüfe ob alle Imports korrekt sind
2. Prüfe `types/preview.ts` auf Syntax-Fehler
3. Führe `npm install` erneut aus

---

### Problem: Tests schlagen fehl

**Symptom:** Jest Tests rot

**Lösung:**

1. Führe `npm run test:verbose` aus
2. Prüfe welcher Test fehlschlägt
3. Prüfe ob neue Imports in Tests fehlen
4. Führe `npm run test:clear` aus und teste erneut

---

### Problem: Preview zeigt weißen Screen

**Symptom:** WebView bleibt weiß, kein Inhalt

**Lösung:**

1. Prüfe Internet-Verbindung (Sandpack braucht esm.sh)
2. Öffne DevTools im WebView (falls möglich)
3. Prüfe ob `buildSandpackHtml()` korrektes HTML generiert
4. Teste mit minimalem Projekt (wenige Dateien)

---

### Problem: "Preview not found" bei Supabase

**Symptom:** 404 Error bei `preview_page`

**Lösung:**

1. Prüfe ob `PREVIEW_SERVICE_ROLE_KEY` gesetzt ist
2. Prüfe ob Secret korrekt ist (Service Role, nicht Anon!)
3. Prüfe ob `save_preview` erfolgreich war (ok: true)
4. Prüfe Supabase Logs: https://supabase.com/dashboard/project/<your-project>/logs/edge-functions

---

## Erfolgs-Kriterien

✅ `npm run typecheck` - 0 Errors  
✅ `npm run lint:ci` - 0 Warnings  
✅ `npm run test:silent` - Alle Tests grün  
✅ App startet ohne Fehler  
✅ Preview erstellen funktioniert  
✅ Fullscreen Navigation funktioniert  
✅ Kein Browser-Wechsel  
✅ Keine 404-Fehler (bei Supabase)

**Wenn alle Kriterien erfüllt sind: Refactoring erfolgreich! 🎉**

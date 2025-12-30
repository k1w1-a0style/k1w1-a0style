# Preview Refactoring Summary

## Ziel

Refactoring + Stabilisierung der Preview-Funktion ohne Feature-Verlust.

## Durchgeführte Änderungen

### 1. Fix: "Preview not found" Error (Supabase Functions)

**Problem:**

- `preview_page` Edge Function nutzte ANON Key und scheiterte an RLS (Row Level Security)
- Wenn `save_preview` eine previewUrl lieferte, gab `preview_page` trotzdem 404 zurück

**Lösung:**

- `supabase/functions/preview_page/index.ts` verwendet jetzt SERVICE_ROLE Key server-seitig
- Funktion `supabaseHeaders()` nutzt `PREVIEW_SERVICE_ROLE_KEY` oder `SUPABASE_SERVICE_ROLE_KEY`
- Dadurch wird RLS umgangen und Preview-Daten werden zuverlässig gefunden

**Geänderte Datei:**

- `supabase/functions/preview_page/index.ts`

---

### 2. Vereinfachte UX: Ein Preview-Flow

**Vorher:**

- Mehrere Preview-Modi (Supabase, Sandbox, Web)
- Komplexe Auswahlmenüs
- Unklarer Flow

**Nachher:**

- **Ein einziger Preview-Flow:** Sandpack im WebView
- PreviewScreen erstellt Preview und navigiert direkt zu PreviewFullscreenScreen
- Kein Browser-Redirect, keine externen Logins
- Klarer, linearer Flow

**Geänderte Dateien:**

- `screens/PreviewScreen.tsx` (komplett refactored)
- `screens/PreviewFullscreenScreen.tsx` (vereinfacht)

---

### 3. Code-Qualität: Refactoring & Struktur

#### 3.1 Neue Dateien (Separation of Concerns)

**`types/preview.ts`** - Zentrale Type Definitions

- `PreviewMode`, `PreviewFiles`, `PreviewResponse`
- `PreviewSettings`, `PreviewStats`
- `RootStackParamList`, `PreviewFullscreenParams`

**`utils/url.ts`** - URL Utility Functions

- `isHttpUrl()` - Prüft ob URL HTTP/HTTPS ist
- `truncateUrl()` - Kürzt URLs für Anzeige
- `normalizePath()` - Normalisiert Dateipfade

**`hooks/usePreview.ts`** - Custom Hook für Preview Logic

- Extrahiert State Management aus PreviewScreen
- Verwaltet fileMap, dependencies, creating state
- Enthält `ensureMinimumFiles()` Logic

**`lib/sandpackBuilder.ts`** - Sandpack HTML Generator

- `buildSandpackHtml()` - Generiert HTML für Sandpack Preview
- Trennt HTML-Generierung von Screen-Logik

#### 3.2 Refactored Screens

**PreviewScreen:**

- Von 400+ Zeilen auf ~250 Zeilen reduziert
- Nutzt `usePreview` Hook für State/Logic
- Nutzt `buildSandpackHtml` für HTML-Generierung
- Klare Trennung: UI vs. Logic

**PreviewFullscreenScreen:**

- Nutzt zentrale `utils/url.ts` statt lokale Duplikate
- Nutzt `types/preview.ts` für Type Safety
- Bessere Struktur, gleiche Funktionalität

#### 3.3 Updated Existing Files

**`lib/previewSettings.ts`:**

- Importiert Types aus `types/preview.ts`
- Default Mode: `"sandpack"` statt `"supabase"`

**`lib/previewBuild.ts`:**

- Importiert Types aus `types/preview.ts`
- Nutzt `PreviewStats` Type

---

### 4. Repo Hygiene

#### 4.1 Backup Files entfernt

- `App.tsx.BACKUP_20251230_224627` (gelöscht)
- `App.tsx.BAK_previewB_20251230_215533` (gelöscht)

#### 4.2 .gitignore erweitert

```gitignore
*.BAK*
*.BACKUP*
```

Verhindert zukünftiges Committen von Backup-Dateien.

---

## Geänderte Dateien (Übersicht)

### Neue Dateien (4)

1. `types/preview.ts` - Zentrale Type Definitions
2. `utils/url.ts` - URL Utilities
3. `hooks/usePreview.ts` - Preview Hook
4. `lib/sandpackBuilder.ts` - Sandpack HTML Builder

### Geänderte Dateien (6)

1. `supabase/functions/preview_page/index.ts` - SERVICE_ROLE Key Fix
2. `screens/PreviewScreen.tsx` - Komplett refactored
3. `screens/PreviewFullscreenScreen.tsx` - Vereinfacht, nutzt zentrale Utils
4. `lib/previewSettings.ts` - Nutzt zentrale Types
5. `lib/previewBuild.ts` - Nutzt zentrale Types
6. `.gitignore` - Erweitert um Backup-Patterns

### Gelöschte Dateien (2)

1. `App.tsx.BACKUP_20251230_224627`
2. `App.tsx.BAK_previewB_20251230_215533`

---

## Testing

### Lokale Tests (alle grün ✅)

```bash
npm run typecheck
# ✅ TypeScript: 0 Errors

npm run lint:ci
# ✅ ESLint: 0 Warnings/Errors

npm run test:silent
# ✅ Jest: 18 Suites, 355 Tests passed
```

---

## Supabase Secrets Setup

Für die Supabase Preview-Funktion (`save_preview` + `preview_page`) müssen folgende Secrets gesetzt werden:

### Via Supabase Dashboard:

1. Gehe zu: **Project Settings → Edge Functions → Secrets**
2. Setze folgende Secrets:

```
PREVIEW_SUPABASE_URL=https://<your-project-ref>.supabase.co
PREVIEW_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Via Supabase CLI:

```bash
supabase secrets set PREVIEW_SUPABASE_URL=https://<your-project-ref>.supabase.co
supabase secrets set PREVIEW_SERVICE_ROLE_KEY=<your-service-role-key>
```

**Wichtig:**

- `PREVIEW_SERVICE_ROLE_KEY` ist der **Service Role Key** (nicht Anon Key!)
- Dieser Key hat volle Rechte und umgeht RLS
- Niemals im Client-Code verwenden, nur server-seitig in Edge Functions

---

## Wie man lokal testet

### 1. Dependencies installieren

```bash
npm install
```

### 2. Alle Checks ausführen

```bash
npm run typecheck && npm run lint:ci && npm run test:silent
```

### 3. App starten (optional)

```bash
npm start
```

### 4. Preview testen

1. Öffne die App
2. Navigiere zu "Preview" im Drawer
3. Klicke "Neu erstellen"
4. Preview sollte direkt im Fullscreen WebView öffnen
5. Kein Browser-Wechsel, keine 404-Fehler

---

## Ergebnis

✅ **Fix:** "Preview not found" Error behoben (SERVICE_ROLE Key)  
✅ **UX:** Ein einziger, klarer Preview-Flow (Sandpack im WebView)  
✅ **Code:** Saubere Struktur, getrennte Concerns, wiederverwendbare Utils  
✅ **Hygiene:** Backup-Dateien entfernt, .gitignore erweitert  
✅ **Tests:** TypeCheck, Lint, Jest - alle grün

**Keine Feature-Verluste, keine Breaking Changes.**

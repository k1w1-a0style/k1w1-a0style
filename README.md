# k1w1-a0style-restored

React-Native/Expo App zum Bauen und Testen von Projekten/Flows mit **integriertem Preview-System**.

## Was das Preview-System kann

Du hast jetzt **drei** Preview-Modi in `PreviewScreen`:

1. **🚀 Supabase Preview (empfohlen)**
   - App schickt Projekt-Dateien an eine Supabase Edge Function (`save_preview`).
   - DB speichert ein Preview-Objekt (`previews` Tabelle) + `secret` Token.
   - `preview_page` rendert eine HTML Seite, die die Files in einem Browser-Sandbox-Runner startet (Sandpack Client).
   - Vorteil: _alles_ bleibt in deiner Supabase Infrastruktur (bis auf die Sandpack Assets via CDN), und die URLs sind über `secret` geschützt.

2. **🧪 CodeSandbox Preview (für dich / Debug / Demo)**
   - App schickt Projekt-Dateien an `create_codesandbox`.
   - Edge Function erstellt eine echte CodeSandbox über deren **define API** und gibt `embed`/`editor` URLs zurück.
   - Wichtig: **CodeSandbox Sandboxes sind öffentlich**. Also **keine sensiblen Daten**.

3. **🌐 Web (lokal)**
   - Du kannst irgendeine lokale URL laden (Metro/Expo/Vite), z.B. für schnelle Tests in der Dev-Umgebung.

---

## Architektur (Preview Flow)

### Supabase Preview

1. `PreviewScreen` sammelt Projektdateien (max. Anzahl + max. Bytes)
2. `save_preview` (Edge Function)
   - validiert Payload
   - speichert in `public.previews`
   - generiert `secret`
   - gibt `previewUrl` zurück → `preview_page?secret=...`
3. `preview_page` (Edge Function)
   - lädt Preview über `secret`
   - blockt abgelaufene Previews
   - rendert HTML mit Sandpack Runtime

### CodeSandbox Preview

1. `PreviewScreen` schickt Projektdateien an `create_codesandbox`
2. `create_codesandbox` baut ein CRA-artiges Dateisystem (`package.json`, `src/index.tsx`, etc.)
3. ruft CodeSandbox API auf und gibt URLs zurück

---

## Setup

### 1) Env

Erstelle `.env.local` (nicht committen) oder `.env` (nur lokal) mit:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<dein-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<dein anon key>

# optional overrides
EXPO_PUBLIC_SAVE_PREVIEW_URL=https://<dein-ref>.supabase.co/functions/v1/save_preview
EXPO_PUBLIC_CREATE_CODESANDBOX_URL=https://<dein-ref>.supabase.co/functions/v1/create_codesandbox
```

### 2) Supabase

Migrations pushen + Functions deployen:

```bash
supabase db push
supabase functions deploy save_preview
supabase functions deploy preview_page
supabase functions deploy create_codesandbox
```

### 3) App

```bash
npm install
npm run typecheck
npm run lint:ci
npm run test:silent
npx expo start -c
```

---

## Wichtige Hinweise (kritisch)

- **Nicht committen:** `.env`, `.env.local` mit echten Keys.
- **CodeSandbox:** öffentlich. Nutze das nur als persönliches Debug-Tool.
- **Browser-Sandbox Limits:** Native Features (Kamera/GPS/Bluetooth) laufen nicht in Browser Previews.

---

## Dateien (Preview relevante Teile)

- `screens/PreviewScreen.tsx`
- `styles/previewScreenStyles.ts`
- `supabase/functions/save_preview/*`
- `supabase/functions/preview_page/*`
- `supabase/functions/create_codesandbox/*`
- `supabase/migrations/*previews*.sql`

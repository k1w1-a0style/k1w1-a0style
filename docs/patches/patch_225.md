# Patch 225 — Gemini Guard + Supabase Edge URL SoT + Logger Cleanup + Remove Legacy exportAndBuild

## Ziel

Dieses Patch räumt vier echte Restpunkte auf:

1) **Gemini**: Guard gegen `contents = []` (sonst 400 Bad Request).
2) **Supabase Edge URL**: Kein hardcoded Project-Ref mehr in `config.ts`. Edge URL wird nur noch aus ENV abgeleitet.
3) **Logging**: `console.log` Hotspots → zentraler `logger` (weniger Noise, konsistenter Output).
4) **Legacy API Surface**: `exportAndBuild` aus `ProjectContext` entfernen (war nur noch „veraltet“-Alert).

---

## Änderungen

### 1) Gemini: `contents[]` niemals leer senden

_Datei:_ `lib/orchestrator.ts`

- `contents` wird jetzt:
  - `trim()`-bereinigt
  - leere Messages werden entfernt
  - **Fallback**: wenn danach `contents.length === 0` → `[{ role: 'user', parts: [{ text: 'Hallo' }] }]`

Akzeptanz:
- Gemini Calls funktionieren auch, wenn nur `system` Messages existieren oder Content leer ist.

### 2) Supabase Edge URL: kein hardcoded Project-Ref in config

_Datei:_ `config.ts`

- `CONFIG.API.SUPABASE_EDGE_URL`:
  - nimmt **EXPO_PUBLIC_SUPABASE_EDGE_URL** wenn gesetzt
  - sonst wird aus **EXPO_PUBLIC_SUPABASE_URL** sauber `/functions/v1` abgeleitet
  - sonst bleibt leer (`""`) → UI/Connections leitet den User

Akzeptanz:
- Im Repo ist keine konkrete Supabase Ref/Host mehr hardcoded.

### 3) Logger Cleanup in Hotspots

_Dateien:_
- `hooks/useBuildStatus.ts`
- `hooks/useNotifications.ts`
- `lib/buildHistoryStorage.ts`
- `contexts/ProjectContext.tsx` (History-Warnung)

- `console.*` → `logger.*`

Akzeptanz:
- Lint/Typecheck grün
- Logging konsistent über `lib/logger.ts`

### 4) Entferne `exportAndBuild` (Legacy)

_Dateien:_
- `contexts/types.ts`
- `contexts/ProjectContext.tsx`

Akzeptanz:
- ProjectContext API enthält keine veraltete Dummy-Funktion mehr.

---

## Testplan

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

Spot-Checks:
- Gemini Provider: Request mit nur System-Message → kein 400.
- App Start / Builds / Notifications / Build-History: keine Runtime Errors, Logs sauber.

---

## Install / Apply

```bash
# 1) ZIP entpacken
unzip -o k1w1-a0style_patch_225.zip -d .

# 2) ZIP löschen
rm -f k1w1-a0style_patch_225.zip

# 3) Checks
npm run typecheck
npm run lint:ci
npm run test:silent

# 4) Commit + Push
git add -A
git commit -m "Patch 225: Gemini guard + supabase edge url SoT + logger cleanup + remove legacy exportAndBuild"
git push
```

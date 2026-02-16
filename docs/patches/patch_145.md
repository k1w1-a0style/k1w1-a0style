# Patch 145: Compact CI Lite modal + Header/Drawer Neon polish + bessere Edge-Errors

## Was ist neu?

### 1) CI Lite UI: weniger "Screen", mehr "Popup"
- Der CI Lite Button im globalen Header öffnet jetzt **ein zentriertes Modal** (statt eines großen Screens mit vielen Toggles).
- Ablauf ist sofort sichtbar:
  - **Lint läuft** → **Typecheck läuft** (mit **3-Punkte-Animation** + Spinner)
  - Danach: **✅ OK** oder **❌ Fehler**
- Es werden **standardmäßig nur Fehler-Zeilen** gezeigt (TS + ESLint + Exit Code).
- Actions unten: **Copy**, **Run öffnen**, **Patch**, **Autofix**.

### 2) Header Optik konsistent (Neon)
- Menü/Preview/Overflow Icons sind jetzt **gift-grün** wie der Rest.
- Buttons haben ein dezentes Neon-Border + dunklen Background.

### 3) Drawer/Sidebar: keine Doppel-Menüs, "Platten" Look
- Doppelte Einträge entfernt.
- Menü-Items sind jetzt klar als **Cards/Platten** erkennbar.
- Icons haben pro Screen **Akzentfarben** (trotz Dark/Neon Basis).

### 4) Edge-Error Debugging (kritisch)
- CI Dispatch nutzt jetzt **direct fetch** zur Edge Function, damit bei Fehlern **Status + Body** in der UI sichtbar werden.
- Wenn der **Edge Admin Key fehlt**, kommt eine klare Meldung.
- 404/401/403 bekommen extra Hint (nicht deployed / Key falsch).

## Dateien geändert
- `components/CiLiteHeaderButton.tsx`
- `components/CustomHeader.tsx`
- `components/ChatHeaderActions.tsx`
- `components/CustomDrawer.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`

## Test
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

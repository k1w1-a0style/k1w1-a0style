# Patch 220 — Remove AI model "Auto" option

Ziel: Das "Auto"-Model sorgt für Verwirrung im Settings-Screen. Ab jetzt werden **nur noch konkrete Modelle** angezeigt/gespeichert.

## Inhalt

- Entfernt das UI-Angebot **"Auto (Provider)"** aus der Model-Liste (alle Provider).
- Default-Konfiguration nutzt konkrete Modelle (kein `selected*Mode = "auto"`).
- Backward-Compat: alte Configs mit `auto` / `auto-*` werden beim Laden **auf Provider-Defaults gemappt** (abhängig vom `qualityMode`).
- Tests angepasst (Auto wird nicht mehr erwartet).

## Betroffene Dateien

- `contexts/AIContext.tsx`
- `screens/SettingsScreen/hooks/useSettingsScreen.ts`
- `lib/__tests__/AIContext.integration.test.ts`
- `__tests__/appInfoBackupPrivacy.test.ts`
- `docs/TODO.md`
- `docs/patches/PATCHLOG_ROOT.md`

## Apply

```bash
# 1) ZIP entpacken
unzip -o k1w1-a0style_patch_220.zip -d .

# 2) ZIP löschen
rm -f k1w1-a0style_patch_220.zip

# 3) Checks
npm run typecheck
npm run lint:ci
npm run test:silent

# 4) Commit + Push
git add -A
git commit -m "Patch 220: remove AI model auto option (UI + migration)"
git push
```

## Akzeptanz

- In Settings taucht nirgends "Auto" als Model auf.
- Nach App-Neustart bleibt die Model-Auswahl stabil (konkret), auch wenn vorher Auto gespeichert war.

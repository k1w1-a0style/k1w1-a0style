# Patch 222 — Android-only + CI Lite Persistence

## Ziele

1) **Android-only**: Nicht-Zielplattformen sollen im Projekt **nicht als Zielplattform** auftauchen (keine Flows/Anleitungen dafür). Gleichzeitig bleibt der Safety-Guard bestehen: halb-existierende **native Ordner** sind ein häufiger EAS-Build-Killer und werden weiterhin als Risiko markiert.

2) **CI Lite = persistent grün**: Wenn du im Header den **CI Lite** Workflow startest (Lint + Typecheck), dann soll der "grün"-Status **persistieren**, damit er im Build-Checklist als abgehakt angezeigt werden kann.

## Änderungen

### Android-only Cleanup
- `lib/diagnostics/preflightChecks.ts`
  - Title/Text angepasst auf **Android-only**.
  - Hinweis: Es wird weiterhin auf **halb vorhandene native Ordner** geprüft (als *riskant*).

### CI Lite Persistence
- `lib/storageKeys.ts`
  - Neue Keys:
    - `CI_LITE_LINT_OK`
    - `CI_LITE_TYPECHECK_OK`
    - `CI_LITE_LAST_RUN_AT`

- `components/CiLiteHeaderButton.tsx`
  - Nach einem **completed** CI Lite Run werden Lint/Typecheck-Flags in AsyncStorage geschrieben.

- `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`
  - Liest die neuen CI Lite Keys und liefert `hasCiLintOk` / `hasCiTypecheckOk`.

- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
  - Checklist bekommt ein neues (optional) Item: **CI Lite (Lint + Typecheck) grün**.

- `screens/EnhancedBuildScreen/components/ChecklistSection.tsx`
  - Sort order erweitert, damit `ci_lite` sinnvoll einsortiert wird.

## Manual Test Plan

1) **CI Lite starten**
   - Im Header auf den CI Lite Button.
   - Workflow starten.
   - Warten bis abgeschlossen.
   - Erwartung: Status wird grün und bleibt nach App-Neustart / Screen-Wechsel erhalten.

2) **Build Screen Checklist**
   - Enhanced Build Screen öffnen.
   - Erwartung: "CI Lite (Lint + Typecheck) grün" erscheint als **optional** (pending → ok nach erfolgreichem Run).

3) **Diagnostics Text**
   - Diagnostic/Preflight laufen lassen.
   - Erwartung: Kein Nicht-Zielplattform-Feature-Text, aber Warnung falls **native Ordner** halb vorhanden.

## Apply

```bash
# 1) ZIP entpacken
unzip -o k1w1-a0style_patch_222.zip -d .

# 2) ZIP löschen
rm -f k1w1-a0style_patch_222.zip

# 3) Checks
npm run typecheck
npm run lint:ci
npm run test:silent

# 4) Commit + Push
git add -A
git commit -m "Patch 222: Android-only cleanup + CI Lite persistence in Build checklist"
git push
```

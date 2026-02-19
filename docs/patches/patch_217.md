# Patch 217 — CI Lite Bugfix + SoT (Edge/Storage) + Connections-SoT

**Datum:** 2026-02-19  
**Basis:** `k1w1-a0style-work-12.1`  
**Patch-Datei:** `k1w1-a0style_patch_217_FIXED.zip`

> Zweck: Dieser Patch setzt die offenen Punkte aus dem Review / `docs/TODO.md` um:
> - CI Lite: Dead Code raus, Stale-Closure fix, Polling cleanup
> - Supabase Edge: fehlende Function-Namen in SoT + Hardcodes entfernen
> - Storage Keys: Drift-Fallen zentralisieren
> - SecureStore/tokenStore: konsistentes Error-Handling
> - Connections Screen: persistenter „Verbunden“-Status (inkl. EAS Init+Link Flow)

---

## Enthaltene Änderungen

### A) CI Lite — echte Bugs (components/CiLiteHeaderButton.tsx)
- Entfernt totes `topContent`-`useMemo` (wurde nie gerendert)
- Fix: `applyPatchFromText` useCallback deps (mind. `githubRepo`, `branch`)
- Fix: Unmount-Cleanup für Polling (`stopPolling` beim Unmount)
- Cleanup: ungenutzte deps (`projectData?.files`) entfernt
- Cleanup: ungenutzter Style `ciBtn` entfernt

### B) Supabase Edge — Function-Namen als Single Source of Truth
- `shared/constants/supabase.ts` erweitert:
  - `CHECK_EAS_BUILD` → `check-eas-build`
  - `SAVE_PREVIEW` → `save_preview`
- Hardcodes ersetzt in:
  - `components/CiLiteHeaderButton.tsx` (workflow-runs/dispatch)
  - `project/services/buildStartService.ts` (trigger-eas-build)
  - `project/services/buildPollingService.ts` (check-eas-build)
  - `hooks/usePreview.ts` (save_preview)
- `project/services/buildPollingService.ts` nutzt jetzt `lib/supabaseEdge.ts` statt lokaler Duplikation

### C) Storage Keys — Drifts entfernt / zentralisiert
- `lib/storageKeys.ts` erweitert (u.a. `DIAGNOSTIC_LAST_OK`, chat privacy keys, build history key, connection status keys)
- Call-sites angepasst:
  - `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`
  - `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`
  - `lib/chatPrivacySettings.ts`
  - `lib/buildHistoryStorage.ts`
  - `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`

### D) tokenStore — konsistentes Error-Handling
- `infra/github/tokenStore.ts`: Admin/Signing/ServiceRole über bestehende SecureStore-Wrapper (wie GitHub/Expo)

### E) Connections Screen — SoT + persistente Status-Lämpchen (screens/ConnectionsScreen/*)
- Persistente Status-Lämpchen (GitHub/Expo/Supabase/EAS/Repo) über `lib/storageKeys.ts` (SoT)
- EAS Link Workflow:
  - Wenn **keine EAS Project ID** eingegeben ist: Confirm-Dialog  
    **„Keine EAS ID vorhanden! Soll eine erstellt werden?“** (`[Abbrechen] [OK]`)
  - Bei OK: startet `eas-link.yml` **ohne** `eas_project_id` → Workflow erstellt/verlinkt ID und committed `eas-project.json`
  - UI-Hinweis: danach **Sync drücken**, damit die App die neue ID übernimmt
- GitHub Connect: speichert zusätzlich Token-Scopes (Header `x-oauth-scopes`) und zeigt sie im Status an (**best-effort**)

---

## Commands zum Anwenden (Screenshot-Style)

```bash
unzip -o k1w1-a0style_patch_217_FIXED.zip -d .
rm -f k1w1-a0style_patch_217_FIXED.zip

npm run typecheck
npm run lint:ci
npm run test:silent

git add -A
git commit -m "Patch 217: CI Lite bugfix + SoT edge/storage + connection screen SoT + tokenStore consistency"
git push
```

---

## Done-Kriterien (Abhaken)
- [ ] `npm run typecheck` grün
- [ ] `npm run lint:ci` grün
- [ ] `npm run test:silent` grün
- [ ] Danach in `docs/TODO.md`: Items **A1–A3**, **B1–B3**, **C1**, **D1**, **E1–E3** abhaken

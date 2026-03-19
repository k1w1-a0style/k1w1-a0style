# Patch 490 — CredentialsWizard Trust-/Safety-/Status-Härtung

## Was wurde geändert?

- `screens/CredentialsWizardScreen/statusContract.ts`: kleiner Wizard-Status-Contract ergänzt, der auf dem bestehenden `verificationContract` aufsetzt und zwischen `verified`, `missing`, `unknown`, `auth_error`, `generated_pending_verification` sowie Busy-Zuständen unterscheidet.
- `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`: Generate-/Refresh-/Recheck-Flows härten jetzt die Semantik konservativ. Erfolgreiches Generate markiert zunächst nur `generated_pending_verification`; erst ein echter erfolgreicher Status-Check hebt auf `verified` an. Auth-/Permission-/temporäre Fehler werden nicht mehr als `missing` gespeichert oder gerendert.
- Derselbe Hook nutzt jetzt einen gemeinsamen Busy-Guard für Wizard-Aktionen, damit keine widersprüchlichen Parallelaufrufe (`generate` vs. `status`) gegeneinander anlaufen.
- `screens/CredentialsWizardScreen/components/KeystoreStatusSection.tsx` + `screens/CredentialsWizardScreen/index.tsx`: UI zeigt die Einordnung jetzt ehrlicher an (inkl. manuellem Re-Check-Hinweis, konservativer Statusquelle und verständlicher Busy-Texte), ohne Secrets oder rohe Fehlerdetails zu leaken.
- Tests ergänzt: `__tests__/credentialsWizard.trustSemantics.test.tsx` deckt Status-Semantik, Generate-Pending, Recheck-Promotion, UI-Texte, Busy-Guard und Verified/Missing-Regressionen ab.

## Kritische Einordnung

- Kein Wizard-Umbau: nur ein kleiner lokaler Status-Contract plus enge Änderungen im bestehenden Hook/UI.
- Bestehende Repo-/Branch-SoT- und Busy-/Serialisierungslogik bleibt erhalten; Parallelaktionen werden eher strenger als lockerer geblockt.
- Persistenz bleibt minimal (`true`/`false` als last-known backend fact); unsichere Zwischenzustände werden bewusst nur im Laufzeit-UI modelliert, damit Auth-/temporäre Fehler nicht fälschlich als dauerhaftes „fehlt“ hängen bleiben.

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

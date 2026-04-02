# Patch 669 - Refactor-Durchlauf 29 (cross-screen small typing follow-up)

## Ziel

Den naechsten kleinen cross-screen props-/navigation-/error-helper-Block helper-first nachziehen, ohne Verhaltens- oder Vertragsaenderungen.

## Umgesetzt

- `screens/AppStatusScreen/components/OverviewSection.tsx` nutzt jetzt eine schmale `ProjectData`-View statt `projectData: any`.
- `screens/AppStatusScreen/hooks/useAppStatusScreen.ts` fuehrt keinen irrefuehrenden `any`-Kommentar mehr.
- `screens/CodeScreen/index.tsx` tipisiert den `beforeRemove`-Navigation-Event ueber React-Navigation-Typen statt `e: any`.
- `screens/CredentialsWizardScreen/components/KeystoreStatusSection.tsx` nutzt einen getypten Ionicons-Namen statt `icon: any`.
- `screens/EnhancedBuildScreen/hooks/useOneClickDeploy.ts` haertet Build-/Secret-Sync-Fehlerpfade ueber `unknown` + `getOneClickDeployErrorMessage(...)`.
- `shared/types/build.ts` fuehrt `raw` nur noch als `unknown`.

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Hinweis

Kein Flow-/Build-/Wizard-/Navigation-Vertrag wurde bewusst umgebaut; der Patch bleibt ein lokaler Typing-/Helper-Nachzug.

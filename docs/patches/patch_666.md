# Patch 666 — Refactor-Durchlauf 26 (AppInfo component typing follow-up)

## Ziel

Den naechsten kleinen props-/render-nahen Typing-Block im AppInfo-Slice helper-first nachziehen, ohne Backup-/Import-/Passphrase-Vertraege zu veraendern.

## Umgesetzt

- `screens/AppInfoScreen/componentTypes.ts` neu eingefuehrt
  - `AppInfoScreenStyles`
  - `AppInfoApiKeysConfig`
  - `AppInfoProjectInfoData`
  - `AppInfoTemplateData`
- `screens/AppInfoScreen/styles.ts` exportiert jetzt zusaetzlich `AppInfoScreenStyles`
- `ActiveApiKeysSection.tsx`, `ApiBackupSection.tsx`, `AppSettingsSection.tsx`, `BackupPassphraseModal.tsx`, `ProjectInfoSection.tsx`, `SecureBackupSection.tsx` und `TemplateInfoSection.tsx` nutzen keine lokalen `styles: any` / `projectData: any`-Props mehr

## Nicht angefasst

- keine Backup-/Import-/Passphrase-Logik
- keine Hook-/Orchestrierungs-Aenderung in `useAppInfoScreen.ts`
- kein Broad Cleanup ausserhalb des AppInfo-Component-Slices

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Ergebnis

Der AppInfo-Component-Block ist jetzt props-/render-seitig enger typisiert und folgt der bisherigen helper-/slice-first Linie, ohne Runtime- oder Flow-Vertraege anzutasten.

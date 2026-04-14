# Patch 658: fehlender Projektzustand + EAS_ID-Globalpfade final geschlossen

## Ziel

Restblock aus Prompt:

1. Datei-Mutationen duerfen ohne gueltigen Projektzustand niemals Erfolg melden.
2. Globale `EAS_PROJECT_ID`-Altpfade (Read/Write/Fallback) muessen aus aktiven Pfaden raus.
3. Bereits reparierte Semantik- und Edge-Typecheck-Fixes bleiben stabil.

## Umsetzung

### 1) Datei-Mutationen fail-closed bei fehlendem Projektzustand

- `createFile`, `deleteFile`, `deleteFiles`, `renameFile` in `ProjectContext` geben jetzt bei fehlendem Projekt (`projectDataRef.current` fehlt) sofort `status: "rejected"` zurueck.
- Zusaetzlich startet der lokale Mutationsstatus nicht mehr optimistisch mit `success`, sondern fail-closed (`rejected`) und wird nur bei echter Mutation auf `success` gehoben.
- Damit kann ein frueher Bailout im Update-Pfad keinen alten Erfolgsstatus mehr durchrutschen lassen.

### 2) Globale `EAS_PROJECT_ID`-Altpfade entfernt

- Neuer scoped Helper in `lib/storageKeys.ts`:
  - `easProjectIdKeyForRepo({ linkedRepo })`
  - liefert **nur** repo-scoped Key oder `null` (kein globaler Fallback).
- Aktive Pfade auf scoped Storage umgestellt:
  - `useConnectionsScreen`
  - `useGitHubReposScreen`
  - `useAppInfoScreen` (Backup/Restore)
  - `autoSyncRepoSecrets`
- Bei fehlendem Repo-Kontext bleibt EAS-ID bewusst leer/neutral statt globalen Legacy-Wert zu laden.

### 3) Semantik-/Edge-Stabilitaet

- Edge-Typecheck-Fix aus Patch 657 (`ensureBucketExists(...)`) bleibt unveraendert gruen.
- `useFileActions`-Erfolgspfad bleibt strikt auf explizites `status === "success"` begrenzt.

## Regressionen

- `projectContext.createNewProject.regression.test.tsx` erweitert:
  - Datei-Mutationen liefern `rejected`, wenn kein Projektzustand geladen ist.
- `useFileActions.regression.test.tsx` erweitert:
  - keine UI-Erfolgsfolge bei `rejected` aus fehlendem Projektzustand.
- Neue Invariant `patch658.easProjectIdScopedStorage.invariants.test.ts`:
  - keine direkten globalen `STORAGE_KEYS.EAS_PROJECT_ID` AsyncStorage-Reads/Writes in den verbliebenen Altpfaden.

## Ergebnis

- Ohne Projektzustand gibt es keine scheinbar erfolgreichen Datei-Mutationen mehr.
- Aktive EAS-ID-Pfade sind repo-scoped; globale Legacy-EAS-ID ist keine Runtime-Wahrheit mehr.
- Edge-/Semantik-Fixes bleiben gruen und regressionsgesichert.

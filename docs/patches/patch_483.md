# Patch 483 — Schritt 8: GitHubReposScreen-Restpunkte kritisch nachgezogen

## Ziel
Nur real bestätigte Restpunkte aus dem Schritt-8-Scope minimal beheben, ohne neue Repo-/Build-Architektur und ohne künstliche Reaktivierung bereits geschlossener Punkte.

## Bestätigte Befunde
- **Repo-Selection-Race weiterhin technisch relevant:** Wenn ein Repo zunächst nur als String/Recent-Pill ausgewählt wurde und der Default-Branch asynchron nachgeladen wurde, konnte ein späterer Auswahlwechsel auf ein Repo mit bereits bekanntem `default_branch` von der alten Async-Antwort überschrieben werden.
- **Manage-Modal-Idempotenz regressiert:** Das Branch-Manage-Modal hatte zwar weiterhin einen `busy`-fähigen Komponentenvertrag, der Screen reichte aber keinen Busy-Status mehr durch. Confirm/Cancel blieben damit während laufender Branch-Aktionen anklickbar.

## Änderungen
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
  - Repo-Selektion invalidiert jetzt **jede** ältere Default-Branch-Nachladung über einen frischen `selectionGen`.
  - Manage-Modal bekommt wieder einen expliziten Busy-State plus zentralen Confirm-Handler.
- `screens/GitHubReposScreen/index.tsx`
  - `ManageTextModal` ist wieder busy-aware verdrahtet.
  - `LocalRemoteDiffSection` erhält `projectFiles` ohne unnötigen `any`-Cast.
- `__tests__/patch483.githubReposScreen.step8.invariants.test.ts`
  - Fokussierte Invariants für Selection-Race, Manage-Modal-Busy-Wiring und den entfernten `any`-Cast.

## Nicht Teil dieses Patches
- Keine Broad-Refactors im GitHubReposScreen.
- Keine künstliche Wiedereröffnung bereits geschlossener Punkte.
- Keine neue Patchlog-/README-Welle außerhalb der minimal nötigen Patch-Dokumentation.

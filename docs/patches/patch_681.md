# Patch 681 — Refactor-Durchlauf 41 (UI/screen test debt cleanup)

## Ziel
Den naechsten screen-/interaction-nahen Test-/Mock-Block helper-first nachziehen, ohne Produktcode oder Vertrage zu aendern.

## Umgesetzt
- `__tests__/oneClickDeploy.test.tsx`
  - `BuildProfile` / `DeployStep` / `DeployStepId` statt lokaler `any`-Profile, Schritt-Casts und `getByTestId: any`
  - lokaler `findStep(...)`-Helper statt `steps.find((s: any) => ...)`
  - `Alert.alert` ueber Spy-Variable statt `Alert.alert as any`
- `__tests__/githubReposScreen.list.test.tsx`
  - getypte Filter-/RepoList-Props und `Record<string, unknown>`-Overrides statt `any`
- `__tests__/chatScreenAttachmentNotice.test.ts`
  - `AttachmentNoticeAsset`-Factory statt Anhang-Objekte `as any`
- `__tests__/ConfirmChangesModal.review.test.tsx`
  - `OrchestratorResult` statt `aiResponse as any`
- `__tests__/connectionsScreen.statusCardSemantics.test.tsx`
  - typed `Animated.CompositeAnimation`-Helper statt `as any`-Animation-Mocks

## Wirkung
- screen-/interaction-nahe Testdateien laufen ohne lokale `any`-Casts
- Produktcode bleibt unveraendert
- der verbleibende Rest-Debt bleibt auf weitere Test-/Fixture-/Historien-Dateien begrenzt

## Validation
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

# Patch 776: PreviewEvalFailClosedAndAppInfoMemoNarrowing

## Scope

Gezielter Sicherheits-/Stabilitaetsdurchlauf im bestehenden Preview-/AppInfo-Scope:
- lokalen Eval-Pfad strikter fail-closed halten
- explizites Dev-Opt-in fuer externen CDN+Eval-Pfad erzwingen
- unnötig breite Memo-Ableitung in `useAppInfoScreen` verengen
- bewusst versionierte Android-Debug-Keystore-Datei bereinigen

## Aenderungen

- `lib/sandpackHelpers.ts`
  - `SandpackOptions` um `allowExternalCdnInUnsafeLocalEval` erweitert.
- `lib/sandpackBuilder.ts`
  - neuer Doppel-Guard: Eval-Pfad nur, wenn **beide** Opt-ins gesetzt sind.
  - fehlendes CDN-Opt-in liefert einen separaten fail-closed Sperr-HTML-Pfad ohne `unsafe-eval`/CDN-Skripte.
- `hooks/usePreviewCreation.ts`
  - lokaler Eval/CDN-Pfad nur noch mit `EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_EVAL=true` plus Dev/Test-Runtime.
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
  - `projectFiles`-Memo auf echte Materialisierungs-Inputs verengt (`files`, `name`, `slug`, `packageName`).
- `lib/__tests__/sandpackBuilder.test.ts`
  - Tests um expliziten Doppel-Opt-in und fail-closed Missing-CDN-Opt-in erweitert.
- `android/app/debug.keystore`
  - aus VCS entfernt.
- `android/.gitignore`
  - `app/debug.keystore` explizit ignoriert.

## Nicht geaendert (bewusst)

- kein Broad-Refactor an Workflow-Template-Hotspots in diesem Durchlauf
- keine Semantik-Aenderung am bevorzugten Remote-Preview-SoT

# Patch 667 - Refactor-Durchlauf 27 (Diagnostic component typing follow-up)

## Ziel
Den naechsten diagnostics-nahen props-/display-Typing-Block helper-first nachziehen, ohne Runner-/Fix-/Upload-Orchestrierung umzubauen.

## Umsetzung
- `screens/DiagnosticScreen/styles.ts` exportiert jetzt `DiagnosticScreenStyles`.
- `FixRunModal.tsx`, `HeaderSection.tsx`, `PreviewModal.tsx` und `ProgressBar.tsx` nutzen keine lokalen `styles: any` / `anim: any`-Props mehr.
- `hooks/useDiagnosticScreen.ts` hat keinen ungenutzten `navigation?: any`-Pfad mehr und nutzt im Fehlerpfad `unknown` + `getDiagnosticUiErrorMessage(...)`.
- `screens/DiagnosticScreen/index.tsx` uebergibt den entfernten Hook-Parameter nicht mehr.

## Verifikation
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Ergebnis
Der diagnostics-nahe props-/display-Block ist enger typisiert, ohne Produktverhalten oder bestehende Diagnostics-Vertraege zu veraendern.

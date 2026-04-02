# Patch 665 — Refactor-Durchlauf 25 (diagnostic typing helper-first)

## Ziel
Den naechsten diagnostics-nahen Typing-/Error-Contract-Block helper-first nachziehen, ohne den Diagnostic-/Upload-/Pipeline-Vertrag zu aendern.

## Umgesetzt
- `components/diagnostics/SeverityBadge.tsx`
  - `icon: any` durch getypten Ionicon-Namen ersetzt.
- `screens/DiagnosticScreen/index.tsx`
  - Fail-Summary-/Debug-Zeilen in `diagnosticScreenDisplayHelpers.ts` ausgelagert; lokale `r: any`-Filter/Mappings entfernt.
- `screens/DiagnosticScreen/hooks/useDiagnosticUpload.ts`
  - Catch-Pfade auf `unknown` gezogen und ueber `diagnosticErrorHelpers.ts` zentralisiert.
- `screens/DiagnosticScreen/hooks/useDiagnosticCiAutofix.ts`
  - Catch-Pfad auf `unknown` gezogen und ueber `diagnosticErrorHelpers.ts` zentralisiert.
- `screens/DiagnosticScreen/hooks/diagnosticRunners.ts`
  - `stage.results` direkt typisiert genutzt, Catch-Pfad auf `unknown` + Helper.
- `lib/diagnostics/buildPipelineDiagnostics.ts`
  - den in Patch 664 referenzierten `getDiagnosticErrorMessage(...)`-Helper sauber vervollstaendigt.

## Tests
- `__tests__/diagnosticErrorHelpers.test.ts`
- `__tests__/diagnosticScreenDisplayHelpers.test.ts`

## Checks
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

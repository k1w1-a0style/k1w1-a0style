# Patch 453 – KI-/Chat-Nachaudit: echter Non-JSON-Restfix + schärfere Regression

## Ziel
Misstrauische Nachkontrolle des zuletzt überarbeiteten KI-/Chat-/Prompting-Blocks mit Fokus auf Schein-Fixes.

## Gefundener echter Restpunkt
- Der Builder-Fehlerpfad war für Antworten im Format `{ output_text: "..." }` noch unvollständig:
  - `normalizeAiResponseDetailed()` extrahierte zwar JSON aus `output_text`,
  - gab bei Non-JSON aber **kein** `responseText` zurück,
  - wodurch der Nutzer im Hook einen generischeren Fehlerzustand bekam statt verständlicher KI-Preview.

## Minimaler Fix
- `lib/normalizer.ts`
  - `responseText`-Extraktion erweitert um `output_text`.

## Tests nachgeschärft
- `lib/__tests__/normalizer.test.ts`
  - Regression: `output_text` ohne Dateiliste liefert parseError + nutzerlesbaren responseText.
  - Regression: Text-Payload mit formalem `files`-Array, das nach Normalisierung leer wird, liefert `no_valid_files_after_normalization`.

## Verifikation (dieser Patch)
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run typecheck` ✅ (im Gesamtlauf vor `lint:ci` erfolgt)
- `npm run lint:ci` ✅ (im Gesamtlauf vor `test:silent` erfolgt)
- `npm run test:silent -- --runInBand lib/__tests__/normalizer.test.ts __tests__/promptEngine.contextPriority.test.ts __tests__/chatFlowStateGuards.test.ts lib/__tests__/projectOwnership.test.ts` ✅
- `npm run test:silent` ✅

## Ehrlicher Status
- KI-/Chat-Non-JSON-Fehlerpfad ist belastbarer als zuvor (für `output_text` jetzt transparent).
- Full-Suite lief im Audit-Lauf grün; dieser Patch bleibt bewusst minimal auf den KI-/Chat-Restpunkt begrenzt.

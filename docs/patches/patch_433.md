# Patch 433

## Ziel
Konservativer End-to-End-Vertragscheck der produktiv genutzten Supabase-Edge-Pfade (Preview, Build, Workflow-Logs/Runs, Keystore-Wizard) mit Fokus auf ehrliches Error-Mapping zwischen App-Callern und Edge-Responses.

## Gefundene Kernabweichung
- `invokeEdgeJson` im Credentials-Wizard behandelte HTTP-200-Antworten mit `{ ok: false, error }` fälschlich als Erfolgspfad.
- Folge: Der Aufrufer musste implizit nachträglich auf `data.ok === false` prüfen; bei zukünftigen Callsites drohte stilles Vertragsdriften.

## Änderungen (minimal)
1. **Contract-Mapping gehärtet**
   - Datei: `screens/CredentialsWizardScreen/hooks/credentialHelpers.ts`
   - `invokeEdgeJson` normalisiert jetzt auch `HTTP 200 + { ok: false, error }` direkt in den Fehlerpfad (`{ ok: false, error, debug }`).
   - Fehlertext wird über vorhandene Sanitization (`sanitizeErrorForUi`) geführt.

2. **Deterministischer Jest-Regressionstest ergänzt**
   - Datei: `__tests__/credentialsWizardInvokeEdgeJson.test.ts`
   - Testet explizit:
     - `HTTP 200 + { ok:false,error }` => Fehlerzweig
     - `HTTP 200 + { ok:true,... }` => Erfolgzweig

## E2E-Audit-Resultat (relevante Flows)
- **Sauber/passend:**
  - Build trigger/polling (`trigger-eas-build` / `check-eas-build`) inkl. Job-ID-Vertrag (positive numerische ID).
  - Preview (`save_preview`) inkl. Fallback auf Local HTML bei Supabase-Fehlern.
  - Workflow runs/logs (`github-workflow-runs` / `github-workflow-logs`) inkl. Soft-State `not_ready`.
- **Gehärtet in diesem Patch:**
  - Keystore-Wizard-HTTP-Mapping für business-errors in 200er Responses.

## Nicht lokal ausführbare, aber notwendige Operator-Voraussetzungen (unverändert)
- Supabase Edge Secrets müssen gesetzt sein (u.a. `K1W1_EDGE_ADMIN_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SIGNING_MASTER_KEY`, Preview-Secrets).
- Signing-Tabellen/Buckets müssen vorhanden und kompatibel sein (`signing_android`, `signing_audit_log`, Storage-Bucket).
- Edge-Functions müssen deployt sein (keine automatische Ausführung in diesem Patch).

## Verifikation
- workflow-/edge-contract guards + typecheck + lint + tests erfolgreich lokal ausgeführt.

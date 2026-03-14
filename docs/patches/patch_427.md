# Patch 427 – Supabase Function Flow Audit: ehrlichere Edge-Fehler im Keystore-Wizard

## Ziel

Konservatives Audit der produktiv genutzten Supabase-Function-Flows (Preview, Workflow, Artifact, Keystore) mit Fokus auf App↔Edge-Verträge und Fehlerpfade.

## Gefundene Kernprobleme

- **Keystore-Wizard verlor Edge-Fehlerdetails**:
  - `invokeEdgeJson(...)` reduzierte nicht-2xx Antworten auf generisches `HTTP <status> <statusText>`.
  - Konkrete Edge-Fehler (`error`/`message`/`details.*`) gingen verloren.
  - Folge: irreführende UX bei fehlenden Secrets/Token/Repo-Parametern.
- **Keystore-Wizard hatte kein Request-Timeout**:
  - bei hängenden Netz-/Edge-Anfragen kein klarer Timeout-Fehler für den Nutzer.

## Änderungen

- `screens/CredentialsWizardScreen/hooks/credentialHelpers.ts`
  - `invokeEdgeJson` mit konservativem `AbortController`-Timeout (`12_000ms`) gehärtet.
  - Bei Timeout wird klarer Fehler `Edge request timeout after 12000ms` geworfen.
  - HTTP-Fehler nutzen jetzt einen dedizierten Parser statt generischer Meldung.
- `screens/CredentialsWizardScreen/utils/security.ts`
  - Neuer Helper `buildEdgeHttpErrorMessage(status, statusText, bodyText)`:
    - bevorzugt explizite JSON-Fehlerfelder (`error`, `message`, `details.error`, `details.message`),
    - fallback auf sanften, gekürzten Text-Snippet.
- `__tests__/credentialsWizardSecurity.test.ts`
  - gezielte Jest-Tests für `buildEdgeHttpErrorMessage` ergänzt (JSON-Error + Text-Fallback).

## Warum minimal

- Keine Änderungen an Supabase-Edge-Funktionen selbst.
- Kein Architekturumbau, kein Broad Refactor.
- Nur ein produktkritischer Contract-/Fehlerpfad im App-Caller wurde gezielt und deterministisch gehärtet.

## Verifikation

- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

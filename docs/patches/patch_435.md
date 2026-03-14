# Patch 435 — Supabase E2E Contract Close-out (Artifact ZIP path + operator clarity)

## Ziel
Den offenen End-to-End-Vertragscheck für produktiv relevante Supabase-Edges abschließen und einen realen Mapping-Fehler minimal beheben.

## Gefundener echter Vertragsfehler
- `github-run-artifact-json` normalisierte ZIP-Pfade mit `replace(/\/g, "/")`.
- Dieser Regex matched in JS nur `/` statt Backslash und lässt `\`-Pfade unverändert.
- Folge: Bei ZIP-Einträgen mit Backslash-Separatoren konnte `filePath`-Matching fehlschlagen (`File not found in artifact zip`), obwohl Datei vorhanden ist.

## Minimaler Fix
- Korrektur auf `replace(/\\/g, "/")` in `normalizeZipPath`.
- Keine API-/Payload-Form geändert, nur robuste interne Pfadnormalisierung.

## Tests
- Neuer Invariant-Test `__tests__/patch435.githubRunArtifactJson.contracts.test.ts` prüft:
  - korrekten Backslash-Regex vorhanden
  - fehlerhaften Regex nicht mehr vorhanden
  - Suffix-Matching bleibt aktiv

## Audit-Status (zusammengefasst)
- Preview (`save_preview` ↔ `usePreview`) vertraglich konsistent: payload + `ok/previewUrl/expiresAt` + fallback auf local preview sauber.
- Workflow-Flows (`github-workflow-dispatch/runs/logs`) vertraglich konsistent: App erwartet `data.workflow_runs`/Fallbacks, Logs inkl. `not_ready` Soft-State.
- Signing/Keystore (`android-keystore-status/generate/export`) lokal konsistent; produktiv weiterhin abhängig von DB/Storage/Secrets-Setup.
- AI (`k1w1-handler`) App-Vertrag bleibt `ok/content/error` stabil; Auth bleibt admin-key-protected.

## Verbleibende Operator-Schritte (nicht automatisch ausgeführt)
- Supabase-Objekte/Schema + Storage + Secrets müssen weiterhin projektspezifisch vollständig gesetzt sein (siehe `docs/TODO.md` und `docs/EDGE_FUNCTIONS_STATUS.md`).

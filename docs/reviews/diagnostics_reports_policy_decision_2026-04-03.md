# diagnostics_reports Policy-Klärung (2026-04-03)

## Ausgangslage

Im Repo gibt es für `public.diagnostics_reports` historisch widersprüchliche Schritte:

- Initial: public read (`anon`/`authenticated`) in `20260110000100_diagnostics_reports.sql`.
- Zwischenstand: authenticated read in `20260203000000_harden_diagnostics_reports_and_rpc.sql`.
- Aktueller Zielstand laut späterem Hardening: deny-read für `anon`/`authenticated` in `20260213000000_rls_audit_hardening.sql`.

Parallel enthält der App-Code weiterhin einen direkten Client-Read-Pfad (`lib/diagnostics/remoteDiagnostics.ts`), der auf einer normalen User-Session basiert.

## Befund

Die aktuelle Repo-SoT ist intern bereits auf **deny-read für anon/authenticated** ausgerichtet
(u. a. Snapshot-/Invariant-Lage rund um Patch 507), aber ein alter App-Lesepfad existiert noch.

Damit liegt kein sauberer, widerspruchsfreier Produktvertrag vor, sondern ein offener
Policy-Entscheidungspunkt.

## Entscheidung in diesem Lauf

- **Kein Blind-Fix an RLS-Policy** (kein riskanter Toggle zwischen `authenticated read` vs. `deny`).
- `diagnostics_reports` bleibt im Repo weiter fail-closed (`anon`/`authenticated` ohne Read).
- Offener Punkt wird als explizite Produkt-/Operator-Entscheidung geführt.

## Entscheidungsoptionen (für nächsten fachlichen Schritt)

1. **Option A (beibehalten, empfohlen für Security-Minimum):**
   - `diagnostics_reports` bleibt nur via privilegierten Operator-/Service-Pfad lesbar.
   - App-UI darf keine direkte Supabase-Client-Query auf die Tabelle als Muss-Vertrag haben.
2. **Option B (produktiver Nutzer-Read):**
   - gezielte, eng begrenzte `authenticated`-Read-Policy mit klaren `USING`-Constraints
     (z. B. repo-/owner-/project-scope), plus dedizierte Regressionstests.
   - nicht als Schnellfix ohne fachliche Scope-Definition.

## Warum kein Sofort-Umbau

Ohne klare fachliche Scope-Regeln (wer darf welche Reports sehen?) wäre ein "mal eben"
aktivierter Read-Policy-Fix entweder zu offen oder potenziell breaking.

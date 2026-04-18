# PRD

## Original problem statement
Mache deep scan und
Prüfe supabase

## User choices
- Scope: gesamter Deep-Scan des Repos
- Supabase: alles rund um Supabase prüfen
- Ergebnis: Analyse + direkte Fixes, wenn Probleme gefunden werden
- Priorität: kaputte Features / Fehlermeldungen und Konfiguration
- Zusatzhinweis: altes Summary sollte Edge Functions end-to-end prüfen
- Antwortsprache: Deutsch

## Architecture decisions
- Das Repo ist eine Expo-/React-Native-App mit starkem Fokus auf Supabase Edge Functions statt klassischem separatem Backend-Service.
- Die sicherheitskritischen Operatorpfade laufen über `supabase/functions/*` und eine Postgres-/RLS-/RPC-Schicht in Supabase.
- Für diesen Durchlauf wurde der Scan bewusst auf Supabase-relevante SoT-Dateien, Migrations, Edge-Funktionen, Live-Logs und Release-/RLS-Checks fokussiert.
- Historische Migrationsdateien bleiben unverändert; der Fix für die Live-Ursache wird append-only als neue Migration abgesichert.

## What has been implemented
- Deep-Scan durchgeführt: `AGENTS.md`, README, Package-/Script-Setup, Supabase-Runbooks, Edge-Status, relevante Migrations und Edge-Routen gelesen.
- Live-Supabase geprüft: Migrationsstand, aktive Edge Functions, Tabellen, Security-/Performance-Advisors sowie Edge-/Postgres-Logs ausgelesen.
- Echte Ursache des Live-Fehlers identifiziert: **nicht** fehlende Migration, sondern PostgreSQL-Fehler `column reference "decision" is ambiguous` in `public.enforce_edge_rate_limit(...)`.
- Repo-Fix umgesetzt: neue Migration `supabase/migrations/20260418170000_fix_edge_rate_limit_decision_ambiguity.sql` ergänzt, die den Tabellenzugriff auf `events.decision` qualifiziert.
- Regressionsschutz ergänzt: `__tests__/patch784.edgeRateLimitDecisionAmbiguity.invariants.test.ts` stellt sicher, dass die Mehrdeutigkeit nicht wieder eingeführt wird.
- Checks erfolgreich ausgeführt: gezielte Jest-Suites grün, `npm run typecheck` grün, `npm run verify:release` grün mit erlaubtem Live-SKIP, `bash scripts/check_supabase_rls_hardening.sh` grün.
- Echte Live-E2E-Prüfung mit bereitgestelltem Operator-JWT ausgeführt und die 503-Störung reproduziert; Logs bestätigten denselben DB-Fehler.
- Danach wurde der SQL-Fix vom Nutzer im Supabase-Dashboard angewendet.
- Abschließende Live-Prüfung erfolgreich: `scripts/check_edge_live_contracts.sh` ist jetzt komplett grün (`k1w1-handler`, `preview_page`, `save_preview`).
- Abschließende Vollprüfung erfolgreich: `npm run verify:release` läuft jetzt mit Live-Contracts und endet auf `OK_FULL` ohne verbleibenden Live-SKIP.
- Zusätzlicher Repo-Guard umgesetzt: `scripts/check_plpgsql_returns_table_ambiguity.js` prüft die neuesten `RETURNS TABLE`-Funktionen auf potenziell mehrdeutige unqualifizierte Ausgabespalten in Prädikaten.
- Release-Gate erweitert: `verify:release` führt den neuen PL/pgSQL-Guard jetzt verbindlich aus.
- Zusätzliche Regression ergänzt: `__tests__/plpgsqlReturnsTableAmbiguityGuard.test.ts` validiert Guard + Release-Wiring.
- Index-Hygiene vorbereitet: neue Migration `supabase/migrations/20260418183000_drop_unused_native_sync_indexes.sql` entfernt genau drei ungenutzte Legacy-Native-Sync-Indizes im Repo-Vertrag.
- Supabase-Auth-Härtung fachlich geprüft: Die aktuell sichtbaren Punkte `Leaked Password Protection` und zusätzliche MFA-Optionen sind laut offizieller Doku für gehostete Projekte Dashboard-/Produkt-Settings und in diesem Setup nicht sauber über die öffentliche Management-API automatisierbar.
- Echter Produkt-/UI-Bugscan für die Hauptscreens durchgeführt: App-/Navigation-/Smoke-Tests sowie gezielte Screen-Suites für GitHub Repos, Connections, Diagnose, Build, Status, Settings, Credentials Wizard und App Info sind grün.
- Test-Härtung umgesetzt: `@expo/vector-icons` wird in `jest.setup.js` für Tests stabil gemockt, um asynchrone Icon-Nebeneffekte/Warnrauschen zu reduzieren.
- Test-Härtung erweitert: direkter Subpath-Import `@expo/vector-icons/Ionicons` wird ebenfalls gemockt, damit die Screen-Suites konsistent bleiben.
- Testbarkeit der Hauptscreens verbessert: zusätzliche `testID`-Marker auf zentralen Screen-Containern und wichtigen Top-Level-Aktionen in mehreren Hauptscreens ergänzt.
- Realistischere Flow-Tests ergänzt: neuer Screen-Aktionstest für `DiagnosticScreen` (Prüfen / Auto-Fix / Bericht) und neuer Header-Test für den Preview-Shortcut (`CustomHeader` → Fullscreen bei gültiger Preview, sonst Fallback auf Preview-Screen).
- Zusätzliche Testbarkeit im Header ergänzt: `CustomHeader` hat jetzt stabile `testID`-Marker für Menü- und Preview-Button.
- Repo-Gates erneut bestätigt: `lint`, `typecheck`, gezielte Frontend-/Smoke-Tests sowie `verify:release` laufen im aktuellen Stand grün; Live-Edge-Contracts sind weiter OK.

## Prioritized backlog
### P0
- Keine offenen P0-Blocker mehr aus diesem Supabase-Fehler.

### P1
- Optional den neuen Guard noch auf weitere SQL-Kontexte (`HAVING`, `ON`, `CASE`) verbreitern.
- Prepared Migration für Legacy-Native-Sync-Indizes bei Bedarf auch live anwenden.
- Offene Testhygiene separat untersuchen: gelegentliche Jest-Worker-Leak-Warnung trotz grüner Suites tiefer analysieren (unter `--detectOpenHandles` im aktuellen Scope nicht hart reproduziert).

### P2
- Dashboard-Settings für Auth-Sicherheit manuell nachziehen (`Leaked Password Protection`, MFA-Optionen/Enforcement), falls gewünscht.
- Dokumentationsdrift zwischen README/Statusdateien bei nächster Doku-Runde bereinigen.
- App-weite `testID`-Abdeckung über weitere tiefere Komponenten ausbauen, falls später echtes E2E/Detox/Playwright-ähnliches Testing gewünscht ist.

## Next tasks
1. Optionalen Guard gegen PL/pgSQL-Mehrdeutigkeiten auf weitere SQL-Kontexte erweitern.
2. Falls gewünscht: Legacy-Native-Sync-Index-Migration live anwenden.
3. Falls gewünscht: Dashboard-Auth-Sicherheitsoptionen manuell einschalten.
4. Optional: Jest-Open-Handle-/Worker-Leak-Warnung gezielt isolieren und bereinigen.

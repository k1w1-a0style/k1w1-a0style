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
- Echte Live-E2E-Prüfung mit bereitgestelltem Operator-JWT ausgeführt und die 503-Störung reproduziert; Logs bestätigen erneut denselben DB-Fehler.
- Live-Datenbank konnte in diesem Arbeitsmodus **nicht direkt mutiert** werden, weil Supabase-Migrationsschreibzugriff hier read-only blockiert ist.

## Prioritized backlog
### P0
- Die neue Fix-Migration auf die echte Supabase-Datenbank anwenden.
- Danach `scripts/check_edge_live_contracts.sh` erneut ausführen, bis `k1w1-handler`, `preview_page` und `save_preview` live grün sind.
- Anschließend `npm run verify:release` ohne Live-SKIP erneut bestätigen.

### P1
- Optional einen zusätzlichen DB-/Repo-Check ergänzen, der mehrdeutige Bezeichner in `RETURNS TABLE`-PL/pgSQL-RPCs früh erkennt.
- Unbenutzte Indizes aus den Supabase-Performance-Advisors fachlich bewerten statt blind zu entfernen.

### P2
- Auth-Sicherheitsoptionen in Supabase prüfen (`Leaked Password Protection`, zusätzliche MFA-Methoden).
- Dokumentationsdrift zwischen README/Statusdateien bei nächster Doku-Runde bereinigen.

## Next tasks
1. Fix-Migration gegen das Live-Projekt anwenden.
2. Live-Edge-Contracts erneut end-to-end testen.
3. Danach vollständige Release-Evidence ohne SKIPs einsammeln.

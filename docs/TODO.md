# TODO

Stand: **2026-02-13** (Post-Patch 92)

> Dieses Dokument ist die **laufende Restliste**.  
> **Alle P1-Findings sind gefixt**, Tests sind grün, Supabase Functions + Migration sind deployed.

## Aktueller Stand

- ✅ Screens: verifiziert (Index: `docs/reviews/SCREENS_VERIFICATION.md`)
- ✅ Supabase: Edge Functions deployed (`supabase functions deploy`) + DB-Migration gepusht (`supabase db push`)
- ✅ GitHubReposScreen RS-004/RS-005 erledigt (Patch 91/92)

## Backlog (offen)

### GitHubReposScreen
- [ ] **RS-006 (P3)** Repo-Liste virtualisieren (Performance bei vielen Repos)  
  _Scope_: nur UI-Perf, keine Optikänderung geplant  
  _Aufwand_: ~2h
- [ ] **RS-008 (P2)** Kritische Screen-Flows testen (Select/Refresh/Branch)  
  _Aufwand_: ~2h

### ConnectionsScreen
- [ ] **CS-006 (P2)** Security-Tests (Eye-toggle / Validation / Sanitization Regression)  
  _Aufwand_: ~2h

### Supabase (Functions + DB)
- [ ] **SB-RLS (P2)** RLS Audit (Tables/Policies/Grants einmal komplett durchgehen + dokumentieren)  
  _Aufwand_: ~2h
- [ ] **SB-Tests (P2)** Edge Security-Tests (Sanitization/Auth/RLS assumptions)  
  _Aufwand_: ~2h
- [ ] **SB-Rate (P3)** DB-backed Rate-Limiting für kritische Functions  
  _Aufwand_: ~3h
- [ ] **SB-MIG-001 (P2)** Migration-Runbook ergänzen (Roll-forward/Rollback + Smoke Checks)  
  _Aufwand_: ~1h

## Abgeschlossen (Kurzlog)

- Patch 75–78: TerminalScreen privacy/perf + Secret-Redaction + Tests
- Patch 79: GitHubReposScreen selection consistency + race guard
- Patch 80: Jest open handles fix (ChatScreen cleanup/unref)
- Patch 81: SettingsScreen API-Key masking + validation
- Patch 82–84: ConnectionsScreen masking/validation/sanitization
- Patch 85–86: EnhancedBuildScreen hardening (guards + status union fix)
- Patch 87: Supabase hardening (RLS + Edge error sanitization + migration)
- Patch 91: GitHubReposScreen refresh unmount guard + stricter owner/repo parsing + tests
- Patch 92: GitHubReposScreen reject whitespace in owner/repo identifier

## Reports (neu)

- `docs/status/EXECUTIVE_SUMMARY.md`
- `docs/status/COMPLETE_PROJECT_STATUS_REPORT.md`

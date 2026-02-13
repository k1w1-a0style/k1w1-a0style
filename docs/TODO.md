# TODO

Stand: **2026-02-13**

> Dieses Dokument ist die **laufende Restliste**.  
> Alle Security-/Privacy-P1-Fixes aus den Screen-Reviews sind umgesetzt und Tests sind grün.  
> Unten stehen nur noch **Restpunkte / Quality-Backlog** (meist P2/P3).

## Status

- ✅ Screens/Reviews sind vollständig unter `docs/reviews/*_VERIFICATION.md` dokumentiert (siehe Index: `docs/reviews/SCREENS_VERIFICATION.md`).
- ✅ Supabase Edge Functions & DB-Migration wurden gehärtet (RLS + Error-Sanitization), siehe `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`.

## Backlog (noch offen)

> Quelle: kritisches Review (zusammengeführt).  
> **P2 = sollte**, **P3 = nice-to-have**.

### GitHubReposScreen

- [x] **RS-004 (P2)** Unmount-Guard / Abort für `onRefresh` (Race: setState nach unmount)  ✅ *(patch 91)*
  _Ort_: `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- [x] **RS-005 (P2)** Striktere `owner/repo`-Validierung + Tests (`splitFullName`/Parsing)  ✅ *(patch 91)*
  _Ort_: `screens/GitHubReposScreen/utils/repos.ts` (+ Tests in `__tests__/`)
- [x] **RS-006 (P3)** Repo-Liste virtualisiert (Root-FlatList), keine VirtualizedList-in-ScrollView Warnungen  ✅ *(patch 94 + hotfix 95)*
  _Ort_: `screens/GitHubReposScreen/index.tsx`
- [x] **RS-008 (P2/P3)** Tests: Repo-List Flows (show/hide + selection)  ✅ *(patch 94 + hotfix 95)*
  _Ort_: `__tests__/githubReposScreen.list.test.tsx`

### ConnectionsScreen

- [ ] **CS-006 (P2)** Security-/Regression-Tests für Masking/Validation (Tokens/Keys)  
  _Ort_: `screens/ConnectionsScreen/*` + `__tests__/`

### Supabase (Audit / Ops)

- [ ] **SB-RLS-002 (P2)** RLS/Policies auditieren (z. B. Zugriffsmatrix dokumentieren, “least privilege”)  
  _Ort_: `supabase/migrations/*` + `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`
- [ ] **SB-FN-003 (P2)** Edge error sanitization: sicherstellen, dass **alle** Functions den shared sanitizer nutzen  
  _Ort_: `supabase/functions/*`
- [ ] **SB-MIG-001 (P2)** Migration-Runbook ergänzen (Roll-forward/Rollback, smoke checks)  
  _Ort_: `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md` / `docs/reviews/SCREENS_VERIFICATION.md`

## Abgeschlossen (Kurzlog)

- **Patch 75–78**: TerminalScreen privacy/perf + Secret-Redaction + Tests  
- **Patch 79**: GitHubReposScreen selection consistency + race guard  
- **Patch 80**: Jest open handles fix (ChatScreen cleanup/unref)  
- **Patch 81**: SettingsScreen API-Key masking + validation  
- **Patch 82–84**: ConnectionsScreen masking/validation/sanitization  
- **Patch 85–86**: EnhancedBuildScreen hardening (Status union + guards)  
- **Patch 87**: Supabase hardening (RLS + Edge error sanitization + migration)

- [x] Patch 92: GitHubReposScreen splitFullName rejects whitespace around '/'
- [x] Patch 94: GitHubReposScreen RepoList virtualized + basic flow tests
- [x] Patch 95: Hotfix for Hook order (eslint) + Jest mock scope in list tests

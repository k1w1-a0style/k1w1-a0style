# Patch 761 — Hotspot-Finalisierung Diagnostics/Auth/AppInfo

## Ziel
Den verbleibenden Abschlussblock sauber fertigstellen:
1. echte Restpunkte/Drifts im Scope schliessen
2. `lib/diagnostics/buildPipelineDiagnostics.ts` restlos zerlegen
3. `supabase/functions/_shared/auth.ts` restlos und sicher zerlegen
4. `screens/AppInfoScreen/hooks/useAppInfoScreen.ts` als duenne Fassade finalisieren

## Umsetzung
- Diagnostics-Split:
  - neu: `lib/diagnostics/buildPipelineDiagnostics.constants.ts`
  - neu: `lib/diagnostics/buildPipelineDiagnostics.helpers.ts`
  - neu: `lib/diagnostics/buildPipelineDiagnostics.checks.ts`
  - `buildPipelineDiagnostics.ts` bleibt Public-Orchestrator + Re-Exports.
- Shared-Auth-Split:
  - neu: `supabase/functions/_shared/auth/runtime.ts`
  - neu: `supabase/functions/_shared/auth/jwt.ts`
  - neu: `supabase/functions/_shared/auth/admin.ts`
  - neu: `supabase/functions/_shared/auth/scoped.ts`
  - neu: `supabase/functions/_shared/auth/rateLimit.ts`
  - `supabase/functions/_shared/auth.ts` bleibt stabile Facade.
- AppInfo-Hook-Split:
  - neu: `screens/AppInfoScreen/hooks/useAppInfoApiConfigFlow.ts`
  - neu: `screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow.ts`
  - `useAppInfoScreen.ts` bleibt UI-nahe Fassade/Orchestrator.
- Invariants/Marker nachgezogen auf modulare Zielstruktur (kein blindes Quellen-Monolith-Matching mehr).

## Verifikation
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- fokussiert:
  - diagnostics/auth/appinfo behavior + invariants
  - docs sync

## Ergebnis
- Alle drei Hotspots sind im Scope restlos zerlegt.
- Public API-/Guard-/RBAC-/Backup-Semantik bleibt bewusst erhalten.
- Kein weiterer Restpunkt im definierten Block offen.

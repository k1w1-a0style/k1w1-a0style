# Patch 136

Datum: **2026-02-15**

## Kontext
- `build_jobs.id` in Supabase ist **UUID**.
- Der Workflow/Builder hat `JOB_ID` bisher als **Zahl** behandelt (z.B. `190`) und damit Supabase so gepatcht:
  `.../build_jobs?id=eq.190` → **400**.

## Änderungen
### 1) Job-ID durchgehend als UUID (string)
- App/Contexts/Hooks/Storage: `jobId` ist jetzt **string (UUID)** statt number.
- Shared Validation: UUID-Checks ergänzt/vereinheitlicht.

### 2) Supabase Status-Updates dürfen den Build nicht mehr killen
- In den Workflow-Templates werden die PATCH-Calls jetzt **best-effort** ausgeführt (`check=False` + Warnung statt Abbruch).

### 3) Tests angepasst
- Build-History Tests erwarten `jobId` als UUID-String (inkl. deterministische Test-UUIDs).

## Betroffene Dateien
- `contexts/types.ts`
- `contexts/ProjectContext.tsx`
- `hooks/useBuildHistory.ts`
- `hooks/useBuildStatus.ts`
- `lib/buildHistoryStorage.ts`
- `lib/supabaseTypes.ts`
- `lib/diagnostics/ciAutoFix.ts`
- `supabase/functions/_shared/validation.ts`
- `lib/__tests__/buildHistoryStorage.test.ts`

## Verifikation
Lokal ausgeführt (CI-äquivalent):
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅

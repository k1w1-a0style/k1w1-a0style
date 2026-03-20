# Patch 510: Android-Keystore-Export-/Status-Secret-Hygiene auf Shared-Helper-Linie gezogen

## Ziel

Die verbleibenden Android-Keystore-Export-/Status-Pfade sollten im engen Scope dieselbe Shared-Secret-/Auth-Linie wie der bereits vereinheitlichte Generate-Pfad nutzen. Dabei sollten keine Auth-Guards gelockert, keine neue Secret-Architektur gebaut und keine angrenzenden Signing-/Credentials-Themen aufgezogen werden.

## Geaenderte Bereiche

- `supabase/functions/_shared/auth.ts`
  - ergaenzt kleine Runtime-Getter `getSupabaseUrl()` und `getSigningMasterKey()` auf Basis des bestehenden `_shared/auth`-Env-Lookups, damit die Keystore-Pfade dieselbe helper-basierte Secret-SoT nutzen koennen.
- `supabase/functions/android-keystore-generate/helpers.ts`
- `supabase/functions/android-keystore-export/helpers.ts`
- `supabase/functions/android-keystore-status/helpers.ts`
  - re-exportieren die benoetigten Shared-Secret-Getter aus `_shared/auth.ts`, ohne die bestehende Auth-/Helper-Struktur der Functions umzubauen.
- `supabase/functions/android-keystore-generate/index.ts`
- `supabase/functions/android-keystore-export/index.ts`
- `supabase/functions/android-keystore-status/index.ts`
  - lesen `SUPABASE_URL` und – wo fachlich noetig – `SIGNING_MASTER_KEY` jetzt ueber die Shared-Helper statt direkt ueber `Deno.env.get(...)`; `getServiceRoleKey(req)` bleibt unveraendert der serverseitige Service-Role-Key-Pfad.
- `__tests__/patch415.edgeAuthGuards.invariants.test.ts`
- `__tests__/edgeHelperVisibility.invariants.test.ts`
- `__tests__/patch510.keystoreSharedSecretHelpers.invariants.test.ts`
  - bestehende Guard-/Helper-Visibility-Invariants auf die neue Shared-Helper-Reexport-Linie erweitert und einen gezielten Patch-510-Invariant fuer das Entfernen paralleler direkter Secret-Reads ergaenzt.

## Vereinheitlichte Secret-/Helper-Pfade

- `SUPABASE_URL`
  - vorher: direkte `Deno.env.get("SUPABASE_URL")`-Reads in Generate/Export/Status
  - jetzt: `getSupabaseUrl()` aus `supabase/functions/_shared/auth.ts`
- `SIGNING_MASTER_KEY`
  - vorher: direkte `Deno.env.get("SIGNING_MASTER_KEY")`-Reads in Generate/Export
  - jetzt: `getSigningMasterKey()` aus `supabase/functions/_shared/auth.ts`
- `SUPABASE_SERVICE_ROLE_KEY`
  - bleibt unveraendert ueber `getServiceRoleKey(req)` aus derselben Shared-Auth-Linie, ohne neue Caller-Secret-Nutzung

## Unveraendert / bewusst nicht im Scope

- Keine Lockerung von `requireAdminKey(req)` in `android-keystore-generate` oder `android-keystore-status`.
- Keine Aenderung am gemischten Guard fuer `android-keystore-export` (`requireAdminKeyOrServiceRoleBearer(req)`).
- Keine neue Storage-, Backup-, Signing-, CORS- oder Credentials-Architektur ausserhalb dieses Keystore-Blocks.
- Keine Aenderungen an anderen Edge-Functions.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis

- Der Android-Keystore-Generate/Export/Status-Block nutzt fuer `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` und `SIGNING_MASTER_KEY` jetzt eine konsistentere Shared-Helper-Linie statt gemischter direkter Env-Lesepfade.
- Auth-/Admin-/CI-Guard-Verhalten bleibt fachlich unveraendert.
- Gezielte Invariants decken Shared-Helper-Reexports, das Entfernen direkter `Deno.env.get(...)`-Reads und die bestehenden Guard-Vertraege regressionsfest ab.

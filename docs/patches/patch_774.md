# Patch 774: SecurityDeepFixPass (Repo-verifizierte Restpunkte)

## Scope

Finaler Deep-Fix-Pass fuer verifizierte Repo-Restpunkte mit Fokus auf:

1. GitHub-Secret-Crypto-Modernisierung (`tweetsodium` -> `libsodium-wrappers-sumo`)
2. Praezisere `signing_android`-RLS-Deny-Semantik (`anon, authenticated` statt grobem PUBLIC-Contract)
3. `search_path`-Hardening fuer sicherheitsrelevante security-definer RPCs
4. Operability-Guard am Startup bei fehlender Edge-URL + Loading-Timeout-Hinweis

## Umgesetzte Aenderungen

- `infra/github/crypto.ts`
  - Encryption auf `libsodium-wrappers-sumo` (`crypto_box_seal`) umgestellt.
  - GitHub-Sealed-Box-Vertrag beibehalten, aber auf aktiv gepflegte Crypto-Basis gehoben.
- `infra/github/secrets.ts`
  - Secret-Encryption-Call async sauber nachgezogen (`await encryptSecret(...)`).
- `supabase/migrations/20260412100000_hardening_signing_and_search_path.sql`
  - alte `signing_android_deny_all`-Policy entfernt (falls vorhanden).
  - explizite restrictive Deny-Policy fuer `anon, authenticated` gesetzt.
  - `enforce_edge_rate_limit(...)` und `insert_diagnostic_upload(jsonb)` auf `search_path = public, pg_temp` gehaertet.
- `App.tsx`
  - Startup-Validation fuer fehlende Supabase-Edge-URL mit sichtbarer Warnung.
  - Initial-Loading bekommt Timeout-Hinweis nach 20s statt reinem Endlos-Spinner.
- Tests:
  - `__tests__/githubCrypto.libsodium.test.ts`
  - `__tests__/supabaseEdge.startupValidation.test.ts`
  - `__tests__/patch774.signingAndroidAndSearchPathHardening.invariants.test.ts`

## Nicht im Repo blind veraendert (bewusst)

- Keine Repo-seitigen Mutationen fuer live-only Supabase-Dashboard-Settings (`verify_jwt`-Flags, Password/Auth-Policies ausserhalb Migration-SoT).
- Keine unbestaetigten Live-Drift-Fixes ohne reproduzierbare Repo-Evidenz.

## Validation

- Voll-Checks inkl. required scripts sowie `typecheck`, `lint:ci`, `test:silent` laufen gruen.
- Zusaetzlich fokussierte Auth-/RateLimit-/Navigation-/Connections-/Crypto-Tests gruen.

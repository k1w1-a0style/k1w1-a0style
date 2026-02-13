# Supabase & Migration Verification

**Datum:** 2026-02-13  
**Scope:** Supabase Client Init, Edge Functions (GitHub/EAS), RLS/Migrations  
**Patch:** 87, 98, 99

## Ergebnis

✅ Security-Hardening umgesetzt, ohne UI/Design-Änderungen.

**Optik/UI:** Keine sichtbaren Änderungen – betrifft nur Logging, RLS und Edge-Error Payloads.

---

## 1) Client: Supabase Init Logging

**Problem (P1):** Console-Logs konnten Supabase-URL/Key-Presence und URL-Teile leaken (Debug/Crash-Reporting).  
**Fix:** `lib/supabase.ts` loggt keine URL/Key-Presence mehr. Nur generische DEV-Logs bleiben.

**Review-Check:**
- Keine `console.log` mehr mit `EXPO_PUBLIC_SUPABASE_*`.
- Kein URL-Substring Logging.
- Fehlerpfad wirft weiterhin eine klare Fehlermeldung (aber ohne Sensitive Details).

---

## 2) RLS: build_jobs darf nicht öffentlich lesbar sein

**Problem (P1):** ursprüngliche Migration erlaubte `anon` `SELECT` mit `using (true)` ⇒ alle Jobs öffentlich.  
**Fix:** neue Migration `20260212000000_build_jobs_rls_hardening.sql`:

- Drop der alten Policy `Public read build_jobs`.
- Revoke table privileges für `anon` + `authenticated`.
- Explizite Deny-Policy für `SELECT` (defense-in-depth).
- `service_role` behält vollen Zugriff.

**Hinweis (wichtig):** Wenn die App in Zukunft Build-Jobs user-spezifisch lesen soll, braucht die Tabelle ein `user_id` und eine `auth.uid() = user_id` Policy – aktuell ist das bewusst gesperrt.

---

## 3) Edge Functions: Error Sanitization

**Problem (P1):** GitHub API Fehler wurden teilweise raw zurückgegeben (Body + URL) – kann Tokens/Secrets enthalten.  
**Fix:** Shared Utility `supabase/functions/_shared/errorSanitization.ts` + Integration in:

- `github-workflow-dispatch`
- `github-workflow-runs`
- `trigger-eas-build`
- `check-eas-build` (job.error_message wird client-seitig redacted)

**Outcome:**
- Keine raw bodies/URLs mehr in Responses.
- `Bearer <token>`, GitHub tokens (`gh*_*`), JWTs und lange “secret-like” Strings werden redacted.
- Hard cap auf Response-Text (default 500 chars).

---

## Quick Regression Checklist

1. `npm run typecheck` ✅
2. `npm run lint:ci` ✅
3. `npm run test:silent` ✅
4. Edge Functions: Fehlerantworten prüfen
   - enthalten keine Tokens / keine URLs / keine raw bodies.

---

## 4) RLS: zusätzlicher Audit & Storage-Hardening

**Patch 98** ergänzt ein Audit-Hardening für Tabellen ohne User-Scoping:

- Neue Migration: `20260213000000_rls_audit_hardening.sql`
  - `diagnostic_uploads`: entfernt breite `SELECT` Policy → **deny** für `anon`/`authenticated`
  - `diagnostics_reports`: entfernt breite `SELECT` Policy → **deny** für `anon`/`authenticated`
  - Storage Bucket `signing`: explizite deny-Policies auf `storage.objects` (read/write)

**Begründung:** Ohne `user_id`/`auth.uid()`-Bindung wäre jeder Auth-User in der Lage, fremde Daten zu lesen.

---

## 5) Edge Functions: Sanitizer überall für Fehlerpfade

**Patch 98** macht Error Sanitization zum Default:

- `errorResponse(...)` in `supabase/functions/_shared/cors.ts` sanitizet `error` + `details` automatisch (Tokens -> `[REDACTED_TOKEN]`).
- `create_codesandbox` sanitizet alle returned error strings.
- `save_preview` sanitizet server-side logging.
- Jest Coverage: `__tests__/supabaseErrorSanitization.test.ts`.

---

## Runbook

Siehe: `docs/runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md`

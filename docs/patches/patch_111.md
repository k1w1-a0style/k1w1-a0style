# Patch 111 – Build Logs: 500-Fix + EAS/Template Alignments

Stand: 2026-02-14

## TL;DR
- `github-workflow-logs` crasht nicht mehr bei GitHub-„Logs noch nicht bereit“ (404/202) → statt **500** kommt ein **sauberes 404/202-„not ready“** zurück.
- `_shared/auth.ts` nutzt `errorResponse()` jetzt mit der **richtigen Argument-Reihenfolge** (verhindert versteckte 500er bei Auth/RateLimit-Fehlern).
- Templates/Checklist/Preflight: **Production = APK** (wie gewünscht), und Dev/Preview sind als „ohne Credentials“ abgesichert.
- ProjectContext: Build-Log-Polling bricht nach Error-Spikes nicht mehr komplett ab.

## Änderungen
### 1) Supabase Edge Function `github-workflow-logs`
- 404/202 vom GitHub-Logs-Zip-Endpoint werden als „not ready“ behandelt und als JSON-Response zurückgegeben.
- Zusätzlich: Wenn Logs 404 liefern, wird vorher der Run-Status geprüft (run exists? in_progress/queued?) → bessere Fehlermeldung.

**Datei:** `supabase/functions/github-workflow-logs/index.ts`

### 2) Auth-Helper: `errorResponse()` korrekt nutzen
`errorResponse(error, req, status, details)` wurde vorher teilweise falsch aufgerufen (führt bei Triggern zu 500).

**Datei:** `supabase/functions/_shared/auth.ts`

### 3) EAS / Templates / Checklist auf APK ausrichten
- Production BuildType in Templates + Checklist auf **apk**.
- Preflight liefert einen SmartFix, falls ein Projekt noch auf `app-bundle` steht.

**Dateien:**
- `eas.json`
- `templates/expo-sdk54-*.json`
- `lib/templateChecklist.ts`
- `lib/diagnostics/preflightChecks.ts`

### 4) Build Polling robuster
Polling wird nicht mehr nach kurzer Fehler-Serie hart beendet.

**Datei:** `contexts/ProjectContext.tsx`

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Erwartetes Verhalten nach Patch
- „Live in App“ Build Logs:
  - wenn GitHub Logs noch nicht verfügbar sind → **404/202 Not Ready**, kein 500.
  - wenn Token/Permissions fehlen → klare Meldung (statt „Internal error“).
- Diagnostic/Template: Production = APK.

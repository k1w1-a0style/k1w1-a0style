# Patch 310 — Offene Aufgaben geprüft (Dokumenten-Audit)

## Ziel
Schneller Projekt-Check auf noch offene Aufgaben (ohne Code-Änderungen), damit Backlog/Next Steps transparent bleiben.

## Ergebnis
Offene Aufgaben wurden aus den SoT-Dokumenten gesammelt und priorisiert dokumentiert:

1. **Preview-Weiterentwicklung**
   - `PreviewScreen` weiter modularisieren (`DeviceFrame`, `PreviewToolbar`, `PreviewStatusBar`)
   - `preview_page` mit optionalem Toggle für raw logs/runtime errors
   - Datei-/Payload-Transparenz in der UI (`fileCount/size/skipped`)
   - Supabase-Cron für `cleanup_expired_previews()`

2. **Logger/Console-Migration**
   - verbleibende `console.*` Hotspots auf `lib/logger.ts` migrieren
   - ESLint `no-console` schrittweise verschärfen

3. **TypeScript-Hygiene**
   - `any`-Debt reduzieren (Start in `lib/orchestrator.ts`, `contexts/AIContext.tsx`)
   - `contexts/types.ts` Shim vollständig auf `shared/types/*` migrieren und entfernen

4. **Stabilität/Sicherheit**
   - serverseitige Payload-Limits für `save_preview`
   - Observability-Verbesserung via strukturierte Edge-Logs (`meta.debug` optional)
   - API-Key-Masking-Callsites gegen `lib/apiKeyMasking.ts` verifizieren

## Geänderte Dateien
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_310.md`

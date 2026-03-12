# PROJECT_CHECKLOG

Kurzlog für den laufenden Stand. Detailhistorie bleibt im Patchlog.

## Zuletzt geprüft / aktualisiert

- 2026-03-12: Patch 418 V1 — Core-Doku auf Post-417-Realität gezogen, offene Restpunkte zentral in `docs/TODO.md` gesammelt, MD-/Notes-Cleanup als nächster Schritt fixiert.
- 2026-03-12: Patch 417 V18 — versehentlich committetes Patch-Artefakt aus dem Repo-Root entfernt, Patch-Bundle-/Patch-Datei-Artefakte per `.gitignore` gegen Re-Commit abgesichert.
- 2026-03-12: Patch 416 — stillgelegte Legacy-Lint-/Native-Sync-Edges auch in `supabase/config.toml` deaktiviert; Guard-/Invariant-Coverage ergänzt.
- 2026-03-11: Patch 414 V13 — Ref-SoT-Invariant robust gemacht (inkl. escaped Template-Dekodierung); dokumentierte branch-basierte CI-Lite-Ausnahme bewusst beibehalten.
- 2026-03-10: Patch 413 — restliche stille Repo-/Branch-Fallbacks in Build/Repo/Diagnostics/Diff/CI-Lite-Pfaden entfernt; Regression-Coverage ergänzt.
- 2026-03-10: Patch 412 — privilegierte Supabase-Funktionen gehärtet (`search_path`, `PUBLIC`-Execute-Revoke) + Guard-/Invariant-Coverage.
- 2026-03-10: Patch 411 V7 — Supabase-Deploy auf `workflow_dispatch` + expliziten `ref` gehärtet; `_shared`-/Single-Function-Guards und Migrations-Policy synchronisiert.
- 2026-03-09: Patch 410/410B — Edge-Auth-Pfade getrennt, explizite CI-Bearer-Guards ergänzt, Service-Role-Handhabung aus Client-Pfaden entfernt.
- 2026-03-09: Patch 409/408 — Upload-ID-Vertrag als opaque string stabilisiert; Build-Job-Vertrag auf positive numerische `jobId` ausgerichtet.

## Hinweise

- Vollständige Historie: `docs/patches/PATCHLOG_ROOT.md`.
- Operative Restliste / Follow-ups: `docs/TODO.md`.

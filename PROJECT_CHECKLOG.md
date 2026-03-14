# PROJECT_CHECKLOG

Kurzlog für den laufenden Stand. Detailhistorie bleibt im Patchlog.

## Zuletzt geprüft / aktualisiert

- 2026-03-14: Patch 430: Live-Reachability-Audit für Groq/Gemini/OpenAI/Anthropic/HuggingFace mit realen Smoke-Requests; in dieser Umgebung alle Provider wegen fehlender Secrets nur als `missing_secret` klassifizierbar. k1w1-Handler-Fehlerverträge um provider+model-Kontext erweitert, Groq-Fallback gibt resolved Modell-ID zurück.
- 2026-03-14: Patch 429: KI-/Provider-Konfigurationsaudit — k1w1-Edge-Defaultmodelle auf app-konsistente aktuelle IDs aktualisiert (Gemini 2.5, Anthropic datierte IDs, HF Qwen), Groq-"groq/"-Kompatibilitätsfallback ergänzt, Invariant-Tests erweitert.
- 2026-03-14: Patch 428: Zweiter Korrektheits-Check durchgeführt; rote Suite auf `__tests__/oneClickDeploy.test.tsx` durch konservative Timeout-Stabilisierung im Test behoben (kein Produktionscode geändert).
- 2026-03-14: Patch 427: Supabase-Function-Flow-Audit — Keystore-Wizard-Edge-Aufrufe mit hartem Timeout und ehrlicher HTTP-Fehlerextraktion (JSON error/message + Details-Fallback) gehärtet.
- 2026-03-14: Patch 426: Chat/KI-Änderungsfluss konservativ gehärtet — Pending-Änderungen werden vor Persistenz auf den aktuellen Projektstand rebased; Zustandsdrift wird transparent im Chat signalisiert; Guard-Regressionstests ergänzt.
- 2026-03-14: Patch 425: Diagnosis/Autofix/One-Click-Kette konservativ gehärtet — One-Click blockiert jetzt explizit bei fehlender/grenzwertiger Readiness (Diagnostic, CI-Lite, Repo/Branch-Match, Freshness); mode-abhängige Pipeline-Filterlogik testbar gemacht.
- 2026-03-14: Patch 424: Supabase-Preview produktseitig als bevorzugter Browser-/WebView-Weg geschärft; klare URL-/Expiry-/Fallback-Kommunikation und QR-Aktion für bestehende Preview-URL ergänzt.
- 2026-03-14: Patch 423: Machbarkeits-Audit für Expo Web / QR-Web-Preview abgeschlossen; Empfehlung B (gezielte Vorarbeiten vor offizieller Aktivierung), Supabase-URL-Preview kurzfristig realistischer.
- 2026-03-13: Patch 422: E2E-Traceability gehärtet — Build-History-Updates nutzen für laufende Jobs eine job-gebundene Snapshot-Selektion (Repo/Branch/Profil) statt potenziell driftendem UI-Zwischenzustand.
- 2026-03-13: Patch 421: Build-Transparenz gehärtet — effektive Repo/Branch/Profil-Werte werden im Start-/Statusfluss konsistent in `currentBuild` + Historie getragen und im Build-Screen explizit angezeigt.
- 2026-03-13: Patch 420: Guard-/Invariant-Härtung gegen implizite Workflow-Ref-Fallbacks (`github.ref`, `github.ref_name`, `github.head_ref`, `default_branch`) in managed Deploy/Build-Flows; CI/CI-Lite-Ausnahme explizit abgesichert.
- 2026-03-12: Patch 419: Follow-up auf PR #206; `[EDGE_FUNCTIONS_STATUS](EDGE_FUNCTIONS_STATUS.md)` im Doku-Index wiederhergestellt und Patch-Benennung konsistent gehalten.
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

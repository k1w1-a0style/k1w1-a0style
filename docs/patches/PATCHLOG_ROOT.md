# Patchlog Root

Append-only Überblick über Patch-Notizen.

## Recent (kompakt)
- Patch 425: One-Click-Deploy um hartes Readiness-Gate (Diagnostik + CI-Lite + Repo/Branch-Frische) erweitert; mode-abhängige Pipeline-Filterlogik testbar extrahiert
- Patch 424: Supabase-Preview als offiziellen Browser-/QR-Preview-Weg im Produkt klarer markiert (URL-/Expiry-/Fallback-Transparenz, QR-Aktion ohne Architekturumbau)
- Patch 423: konservatives Machbarkeits-Audit für Expo Web / QR-Web-Preview (ohne Umbau); Empfehlung B mit minimalen Vorarbeiten
- Patch 422: job-gebundene History-Selektion für Repo/Branch/Profil im Build-Polling gehärtet (E2E-Traceability gegen Drift zwischen UI-Zustand und gestarteter Build-Wahrheit)
- Patch 421: Build-Traceability für gestartete Jobs gehärtet (Repo/Branch/Profil konsistent in CurrentBuild/History/UI sichtbar, inkl. CSV-/Status-Transparenz)
- Patch 420: managed-workflow guardrails gegen implizite ref/default-branch Fallbacks gehärtet; CI/CI-Lite-Ausnahme explizit als Vertrag abgesichert
- Patch 419: follow-up auf PR #206; `EDGE_FUNCTIONS_STATUS`-Indexlink in `docs/INDEX.md` wiederhergestellt und Patch-Benennung konsistent gehalten
- Patch 418 V1: trust/docs consolidation sweep; core architecture docs auf Post-417-Stand gezogen, offene Follow-ups zentral in TODO gesammelt, MD-/Notes-Cleanup als nächster Schritt verankert
- Patch 417 V18: V17-Verträge beibehalten, versehentlich committetes Repo-Root-Patch-Artefakt entfernt, Patch-Bundles/-Dateien gegen Re-Commit ignoriert
- Patch 416: retired lint/native-sync edge functions in `supabase/config.toml` deaktiviert, 410-legacy stubs explizit belassen, Guard-/Invariant-Coverage ergänzt
- Patch 415 V3: workflow-/CI-edge paths auf gemeinsamen admin-or-CI-bearer guard ausgerichtet; wizard/keystore setup admin-only belassen
- Patch 414 V13: explizite Ref-SoT-Invariants für Workflow-Templates gehärtet; dokumentierte branch-basierte CI-Lite-Ausnahme bewusst erhalten
- Patch 413: restliche stille repo/config + branch/main fallbacks entfernt; Repo/Branch-SoT-Regression-Coverage ergänzt
- Patch 412: `_diagnostic_upload_guard()` mit explizitem `search_path`; versehentliche `PUBLIC` execute-Rechte entzogen; Guard-/Invariant-Coverage ergänzt
- Patch 411: Supabase deploy workflow auf `workflow_dispatch` + required `ref` gehärtet; single-function/_shared guards + migrations policy + metadata synchronisiert
- Patch 410 / 410B: Edge admin auth vom service-role lookup getrennt, CI bearer guard ergänzt, service-role handling aus Client-Pfaden entfernt
- Patch 409 / 408: diagnostics upload ids als opaque strings im Client stabilisiert; build job id contract auf positive numerische IDs ausgerichtet
- Patch 407–403: Repo/Branch-SoT-Härtung, Workflow-Governance, Contract-/Drift-Guards und Doku-Sync konsolidiert
- Patch 401–389: Provider-/Helper-Invariants, CI-Lite-SHA-/Template-Drift-Härtung, Dispatch-/Trigger-Polish

## Historical (selected)
- Patch 388: workflow drift validator + stronger patch artifact discipline
- Patch 387: managed workflow drift hardening + CI-lite template SHA metadata + cleanup
- Patch 386: SHA hardening phase 2 + workflow marker completion + patch artifact discipline
- Patch 385: Project-context SoT correction + CI Lite artifact/autofix hardening
- Patch 383: Workflow hardening for explicit ref handling + manual-path transparency
- Patch 382: Build screen CI Lite gating + stale transparency
- Patch 381: CI Lite SoT hardening + build gate metadata persistence
- Patch 380: CI Lite dispatch robustness (ref input + auto-bootstrap on 422)
- Patch 379: Guard against flattened workflow YAML/templates + invariant test to catch newline loss
- Patch 374: CI-Lite workflows produce deterministic result JSON artifact + checkout input ref
- Patch 373: Metro blockList CI-lite env overlay + remove private metro-config import
- Patch 372: Expo/Metro ignores CI-Lite env overlay files (fix dev bundler parse error)
- Patch 371: CI-Lite workflow templates pin ESLint@8 fallback for legacy configs
- Patch 370: Patchlog restore patch_337 dual references (invariant I10)
- Patch 369: CI-Lite in-app status uses GitHub truth (fix green/rot mismatch)
- Patch 368: CI-Lite smoke diagnostics + gitignore

## Legacy patch-337 references
- docs/patches/patch_337.md
- docs/patches/PATCH_337_NOTES.md

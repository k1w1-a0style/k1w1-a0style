# PROJECT CONTEXT — Mobile Build Orchestrator

Stand: **2026-04-02 (Docs Konsolidierung)**

## Produkt in einem Satz

Eine mobile Expo-/React-Native-App, die **Repo + Branch + Secrets + Build-Profil** in einen kontrollierten GitHub-/EAS-Build- und Diagnostics-Flow uebersetzt.

## Was dieses Repo ist

Dieses Repo enthaelt **die Builder-App**, nicht den Android-Build selbst. Die App:

1. sammelt und validiert lokale Tokens / Secrets
2. orchestriert Repo-/Workflow-/Secret-Zustand
3. triggert GitHub-Actions-/EAS-Flows
4. liest Laufstatus / Logs / Artefakte kontrolliert zurueck
5. fuehrt Diagnostics- und Fix-Loops fuer Repo-/Build-Readiness

## Kanonische Produktpfade

- **GitHub Repos** — Repo / Branch waehlen
- **Connections** — Tokens / Connectivity / Secret-Sync
- **Diagnostics** — Build-Readiness pruefen und Fix-Loops starten
- **Build** — nur bei gruener Readiness dispatchen
- **Status / History / Preview / Chat** — Laufzeit- und Arbeitsflaechen

## Wichtige Vertraege

- kein stiller Repo-/Branch-Fallback in produktiven Build-/Deploy-Pfaden
- produktive Workflow-/Build-/Artifact-/Keystore-Routen sind fail-closed und auth-/scope-gebunden
- `k1w1-handler` laeuft im aktuellen Repo-Stand auf verified JWT + Claim, ohne lokalen Legacy-Admin-Key als Produktvertrag
- `save_preview` nutzt einen verifizierten Login-JWT-Vertrag; `preview_page` bleibt bewusst public secret-link
- `create_codesandbox` ist deaktiviert und nur noch historischer Compat-Kontext

## Bewusst ausserhalb des Repos

- externes `build_admin`-Provisioning
- produktive Secret-Rotation / Dashboard-Setup
- Live-/Staging-Verifikation gegen echte Zielumgebungen

Das sind reale Betriebsaufgaben, aber keine offenen Repo-Codefehler.

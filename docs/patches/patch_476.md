# Patch 476

## Titel
UX-/Flow-Consistency für Repo, Connections, Secret-Sync und EAS-Link konservativ nachgeschärft

## Kontext
Es blieben bestätigte Restpunkte in der Nutzerkommunikation offen: uneinheitliche Einstiegs-Hinweise zwischen Build/Repo/Connections, zu breite Secret-Sync-Erwartung, unscharfe Trennung der EAS-Rollen und zu indirekte Kommunikation manueller Production-Schritte.

## Änderungen (minimal)

1) Konsistente Einstiegsscreen-Hinweise
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
  - Build-Gate-Meldungen verweisen konsistent auf den **GitHub-Repos-Screen** für Repo/Branch-Verknüpfung.

2) Secret-Sync-Kommunikation an realen Umfang angepasst
- `screens/ConnectionsScreen/index.tsx`
  - Sync-Summary listet nur real auto-synchronisierte Repo-Secrets aus der App (EXPO_TOKEN, SUPABASE_URL, optional EAS_PROJECT_ID/K1W1_EDGE_ADMIN_KEY).
  - Manuelle Grenzen werden explizit genannt (Service-Role-Key für Production/Reporting; lokale Device-Werte bleiben lokal).
- `screens/GitHubReposScreen/components/SecretsSection.tsx`
  - Required/Optional-Semantik auf app-gemanagten Scope geschärft.
  - Expliziter Hinweis auf manuellen Production-Schritt für `SUPABASE_SERVICE_ROLE_KEY`.

3) EAS-Rollen zwischen Connections und Repo-Flow sprachlich getrennt
- `screens/ConnectionsScreen/components/EasCard.tsx`
  - Klartext: Connections verwaltet Token + Project ID; EAS-Link läuft im GitHub-Repos-Screen.
- `screens/GitHubReposScreen/index.tsx`
  - EAS-Link-Section erklärt den Repo-seitigen Zweck (Dateien/Workflow im Ziel-Repo) und verweist für Basis-Verbindungen auf Connections.

4) Build-Autoflow-Hinweis realistischer
- `screens/EnhancedBuildScreen/components/OneClickDeployCard.tsx`
  - Option-Hinweis präzisiert: auto-sync betrifft nur app-verwaltete Repo-Secrets; Production-Secrets bleiben manuell.

5) Gezielt ergänzte Invariants
- `__tests__/patch476.flowCopyConsistency.invariants.test.ts`
  - Sichert Screen-Routing-Hinweise, Secret-Sync-Abgrenzung und EAS-Rollen-Trennung gegen Drift.
- `__tests__/invariants.strings.test.ts`
  - Erwartungstexte für Repo/Branch-Gate auf GitHub-Repos-Screen aktualisiert.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Offen
- Keine Architekturänderung im Secret-/EAS-Mechanismus.
- Keine neuen Build-/Provisioning-Features.
- Nur Kommunikations-/Flow-Klarheit entlang bestehender Logik.

# Patch 302: Fix EAS/CI workflow-dispatch 404 (auto-resolve + bootstrap managed workflows)

## Was war kaputt?
- **CI Lite / Diagnose** konnte mit **404 (workflow not found)** scheitern, obwohl im Repo andere Workflows vorhanden waren.
- Ursache: Dispatch lief strikt über **Workflow-Dateiname**, der je nach Repo/Branch nicht vorhanden war (oder anders hieß). GitHub liefert dann 404.
- Zusätzlich wurden manche K1W1-Workflows (z. B. `k1w1-diagnostics.yml`) nicht als „managed“ geführt → konnten bei Push/Pull/Core-Files-Flows unter Umständen fehlen.

## Fix / Verhalten jetzt
1. **Workflow Dispatch robust gemacht**
   - Erst Dispatch über **Dateiname**.
   - Wenn 404 → **Workflows im Repo listen** und passenden Workflow per **workflow_id** dispatchen.
   - Wenn weiterhin 404 und es ist ein **bekannter K1W1-Workflow** → Workflow wird **automatisch** in `.github/workflows/<file>` auf dem Ziel-Branch erstellt/aktualisiert und danach erneut dispatcht.

2. **Managed Workflows erweitert**
   - `k1w1-diagnostics.yml` wurde zu den managed Workflows hinzugefügt.

## Dateien
- `infra/github/workflows.ts`
- `infra/github/utils.ts`
- `infra/github/workflowTemplates.ts` (neu)

## Notes
- Auto-Bootstrap greift **nur** für bekannte Templates (K1W1-managed Workflows), um nichts Fremdes anzufassen.
- Fehlertexte enthalten jetzt zusätzlich eine kurze Liste vorhandener Workflows (best-effort), damit man sofort sieht, was im Repo liegt.

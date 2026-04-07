# Hotspot + Drift Gesamtanalyse (Runde 2)

Stand: **2026-04-07 (Analyse-only, kein Grossumbau)**

Diese Notiz dokumentiert die erneute Gesamtanalyse der verbleibenden Wartbarkeits-/Struktur-Hotspots und Drift-Risiken gegen den aktuellen Repo-Stand.

## Bestaetigte Hotspots

- ConnectionsScreenRefactor (`screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`)
- ProjectContextRefactor (`contexts/ProjectContext.tsx`)
- LocalRemoteDiffSectionRefactor (`screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`)
- SecretsSectionRefactor (`screens/GitHubReposScreen/components/SecretsSection.tsx`)
- CiLiteWorkflowFurtherSplit (`components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`)
- DiagnosticScreenFurtherSplit (`screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`)
- Zusatz: `hooks/useChatAIFlow.ts`
- Zusatz: `shared/workflows/managedWorkflowTemplates.ts`

## Kern-Drift-Risiken (zusammengefasst)

1. **Marker-/String-basierte Contract-Checks** bleiben fragil (kann semantische Drift nicht voll abdecken).
2. **Docs-Contract-Checks sind markerstark**, aber nur teilweise semantisch.
3. **Sehr breite public Hook-/Context-Schnittstellen** (v. a. Connections/ProjectContext) beguenstigen Implementierungsdrift.
4. **Workflow-Template-SoT ist funktional stark abgesichert, aber noch monolithisch**, dadurch hohe Review-/Merge-Diff-Last.
5. **Chat-Orchestrierung bleibt gross** und regressionsanfaellig bei kleinen Text-/Intent-Aenderungen.

## Empfohlene Umsetzungsreihenfolge

1. ConnectionsScreenRefactor
2. LocalRemoteDiffSectionRefactor
3. SecretsSectionRefactor
4. CiLiteWorkflowFurtherSplit
5. DiagnosticScreenFurtherSplit
6. ProjectContextRefactor
7. managedWorkflowTemplates Split
8. useChatAIFlow (nur selektive helper-first Schnitte)

## Hinweis

Diese Runde ist bewusst analyse-only. Kein struktureller Runtime-Umbau wurde gestartet.

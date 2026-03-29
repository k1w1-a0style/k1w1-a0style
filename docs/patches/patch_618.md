# Patch 618: Strukturierter Hook-Refactoring-Audit (ohne Grossumbau)

## Ziel

Repo-weit belastbar einordnen, welche Hooks nur gross sind und welche tatsaechlich riskant gekoppelte Verantwortlichkeiten tragen — ohne in diesem Schritt funktionale Vertraege umzubauen.

## Vorgehen

1. Inventar ueber Hook-Dateien (`use*.ts` / `use*.tsx`, Fokus auf produktive Hooks).
2. Bewertung je Hook nach:
   - Groesse / Dichte
   - Verantwortungsbreite
   - Seiteneffekt-Intensitaet
   - externe IOs (Netzwerk/Storage/Navigation)
   - Testbarkeit
   - Vertragsnaehe zu Build/Auth/Workflow/Preview/Keystore
3. Klassifikation in A/B/C/D inkl. priorisiertem Refactoring-Plan.

## Ergebnis

- Die Top-Risiko-Hooks sind jetzt klar priorisiert und technisch ehrlich dokumentiert in `docs/04-risk-hotspots.md`:
  - **A:** `useGitHubReposScreen`, `useCiLiteWorkflow`, `useConnectionsScreen`, `useCredentialsWizardScreen`, `useDiagnosticFixRunner`
  - **B:** `useChatAIFlow`, `useAppInfoScreen`
  - **C (gross, aber vorerst stabil):** `usePreview`, `useEnhancedBuildScreen`, `useGitHubActionsLogs`
  - **D:** kleinere, derzeit unkritische Hooks
- Pro Top-Hook sind konkrete Schnittkandidaten benannt (IO/API-Layer, UI-vs-Domain-State, Error-Normalization, Persistenz, Query-vs-Mutation).
- Explizite "nicht jetzt"-Liste verhindert blinden Grossumbau in sensiblen Vertragsflaechen.

## Code-/Vertragsstatus

- **Keine grossen Hook-Refactors** in Patch 618.
- **Keine funktionalen Vertragsaenderungen** an Build/Workflow/Auth/Keystore/Preview.
- Schwerpunkt ist rein Audit-, Priorisierungs- und Plan-Synchronisation in der Doku.

## Synchronisierte Doku

- `docs/04-risk-hotspots.md` (neuer Hook-Audit-Block mit Priorisierung und Schnittplan)
- `README.md`
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`

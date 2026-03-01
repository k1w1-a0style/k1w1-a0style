# 05 — Contract Test Coverage Matrix (State Contract)

## Scope
Diese Matrix bewertet **nur** die Invarianten aus `docs/01-state-contract.md` gegen bestehende Tests im Repo (Jest + Testing Library RN).

---

## Coverage Matrix

| Invariante (aus Contract) | Bestehende Abdeckung (Datei / Test) | Bewertung | Gap | Priorität |
|---|---|---|---|---|
| 1. `linkedRepo`-Änderung muss appweit konsistent sichtbar sein | `__tests__/githubReposScreen.list.test.tsx` (Repo/Branch-Selection UI-Flows), `__tests__/diagnosticPreferencesHydration.test.tsx` (Hydration-Schreibschutz) | **Teilweise** | Kein expliziter Integrationstest, der **ProjectContext → GitHubContext Mirror** + Screen-übergreifende Konsistenz in einem Lauf beweist | **Hoch** |
| 2. `preferredBuildProfile` nur `development\|preview\|production` | `lib/__tests__/buildStartService.integration.test.ts` (normalize/through-flow), `__tests__/edgeFunctionContracts.test.ts` (Trigger-Request Profil-Validierung) | **Gut, aber nicht vollständig** | Kein direkter Test für `setPreferredBuildProfile`-Persistenz + Restart-Hydration in UI-Kontext | Mittel |
| 3. Build nur mit gültigem `owner/repo` + gesetztem Branch | `__tests__/invariants.selection.test.ts` (kein stiller `main`-Fallback im Build-Screen), `lib/__tests__/buildStartService.integration.test.ts` (Build-Invoke Sequenz) | **Teilweise** | Build-Service erlaubt weiterhin branch-Fallbacks (`getDefaultBranch`/`main`) und wird aktuell nicht durch „must fail without branch“-Test abgesichert | **Hoch** |
| 4. Keine hartkodierten Branch-Fallbacks im kritischen Buildpfad | `__tests__/invariants.selection.test.ts` (nur Build-Screen Stringcheck) | **Niedrig/Teilweise** | Kein Schutz für kritische Pfade außerhalb Build-Screen (`buildStartService`, `ConnectionsScreen`, `remoteDiagnostics`, Supabase validation/functions) | **Hoch** |

---

## Spezielle Prüfung (gezielt auf Risikofragen)

### A) Branch-Fallbacks (`getDefaultBranch` / `"main"`) im Buildflow
**Befund:** Ja, mehrere Fallbacks existieren noch.

Hotspots:
- `project/services/buildStartService.ts` (`bestEffortPushToGitHub` + finaler Return `branch: buildBranch || "main"`).
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` (`activeBranch || linkedBranch || "main"`).
- `lib/diagnostics/remoteDiagnostics.ts`, `lib/diagnostics/buildPipelineDiagnostics.ts` (Fallback auf `"main"`).
- `infra/github/branchOps.ts` (`json.default_branch || "main"`).
- `supabase/functions/_shared/validation.ts` (`ref: br.value || "main"`).

**Risiko:** Contract-Invariante 4 wird derzeit verletzt, und Invariante 3 kann still umgangen werden.

### B) Doppelte Wahrheiten (`activeBranch` vs `linkedBranch`) / Drift-Risiko
**Befund:** Drift-Risiko ist real und dokumentiert.

- `contexts/GitHubContext.tsx` persistiert `active*` separat als UX-State und mirrored parallel von `linked*`.
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts` und `screens/GitHubReposScreen` schreiben/lesen teils beide Ebenen.
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts` liest Branch aus mehreren Quellen (`linkedBranch`, `activeBranch`, `currentBuild?.branch`).

**Risiko:** Reihenfolge/Hydration kann abweichende Zustände erzeugen (gerade bei Restart).

### C) Persistenz nach Restart (Status-Lampe + BuildProfile + Repo/Branch)
**Befund:** Teilabdeckung vorhanden, aber keine volle Contract-Kette als Integrationstest.

- `diagnosticPreferencesHydration` deckt „keine frühe Überschreibung vor Hydration“ ab.
- Es fehlt ein Ende-zu-Ende-Test für Restart-Hydration: `linkedRepo/linkedBranch/preferredBuildProfile` plus Diagnostic/CI-Lampenflags (`DIAGNOSTIC_LAST_OK`, `CI_LITE_*`) müssen nach Neustart konsistent sichtbar sein.

---

## Vorschlag: 12 wichtigste neue Smoke/Invariant-Tests (priorisiert)

> Ziel: maximaler Risikoschutz mit minimalem Wartungsaufwand.

1. **[Hoch] Integration — Build blockt ohne Branch trotz validem Repo**  
   - Setup: `projectData.linkedRepo="owner/repo"`, `linkedBranch=""`, Tokens vorhanden.  
   - Mock: `useBuildPreconditions`, `startBuild` spy.  
   - Assert: Build-CTA disabled/fehlermeldung, `startBuild` **nicht** aufgerufen.

2. **[Hoch] Integration — Build-Service darf nicht auf `main` fallen wenn Contract strict-mode aktiv**  
   - Setup: `startBuildJob` mit leerem `linkedBranch`.  
   - Mock: `getDefaultBranch` wirft/leer.  
   - Assert: klarer Fehler statt stiller Fallback. *(Contract-Härtungstest, aktuell vermutlich rot — bewusst als Guiding-Test).* 

3. **[Hoch] Integration — ProjectContext→GitHubContext Mirror nach Repo/Branch-Wechsel**  
   - Setup: Provider-Stack rendern, `setLinkedRepo("o/r","dev")`.  
   - Mock: AsyncStorage in-memory.  
   - Assert: `activeRepo/activeBranch` spiegeln exakt `linked*`.

4. **[Hoch] Integration — Restart-Hydration: Repo/Branch bleiben stabil**  
   - Setup: Storage mit `projectData.linkedRepo/linkedBranch` + ggf. divergierenden `active*`.  
   - Mock: App-Neustart via unmount/remount.  
   - Assert: finale UI/Context nutzt `linked*` als SoT, kein Snapback auf stale `active*`.

5. **[Hoch] Integration — Restart-Hydration: preferredBuildProfile bleibt erhalten**  
   - Setup: gespeichertes Profile `production`.  
   - Assert: Build-Screen initialisiert Filter/Profil konsistent ohne Rückfall auf `preview`.

6. **[Mittel] Integration — Restart-Hydration: Diagnostic/CI Lampen aus Storage**  
   - Setup: `DIAGNOSTIC_LAST_OK=true`, `CI_LITE_LINT_OK=true`, `CI_LITE_TYPECHECK_OK=false`.  
   - Assert: Lampen/Freigabezustand nach Remount exakt entsprechend.

7. **[Mittel] Unit — `setPreferredBuildProfile` reject/guard für ungültige Werte**  
   - Setup: direkte Funktions-/Reducer-Ebene.  
   - Assert: nur erlaubte Enum-Werte werden persistiert.

8. **[Mittel] Integration — AppInfo Import darf Mirror nicht als SoT priorisieren**  
   - Setup: Import-Payload enthält widersprüchlich `activeBranch` vs `linkedBranch`.  
   - Assert: finaler Build-Branch = `linkedBranch`.

9. **[Mittel] Integration — ConnectionsFlow nutzt SoT-Branch statt `"main"` fallback**  
   - Setup: `activeBranch=""`, `linkedBranch="feature/x"`.  
   - Assert: API-Aufruf nutzt `feature/x`, nie `main`.

10. **[Mittel] Unit — `validateTriggerBuildRequest` muss branch verpflichtend machen (Contract-Mode)**  
    - Setup: Request ohne `branch/ref`.  
    - Assert: Validation `ok=false`.

11. **[Niedrig] Integration — BuildHistory/Status bleibt bei App-Restart**  
    - Setup: gespeicherte letzte Build-Statusdaten.  
    - Assert: Anzeige konsistent, keine falsche running-Lampe.

12. **[Niedrig] Unit — Branch normalization trimmt Whitespace, aber setzt keinen stillen Default**  
    - Setup: branch=`"   "`.  
    - Assert: invalid statt auto-`main`.

---

## Bonus: 5 schnelle Invariant String Tests (Copy-Paste Jest)

```ts
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("Contract Invariant Stringchecks", () => {
  test("Buildflow: kein harter main-Fallback im StartBuildService", () => {
    const src = read("project/services/buildStartService.ts");
    expect(src).not.toMatch(/\|\|\s*["']main["']/);
  });

  test("ConnectionsFlow: kein stiller main-Fallback für Branch", () => {
    const src = read("screens/ConnectionsScreen/hooks/useConnectionsScreen.ts");
    expect(src).not.toMatch(/activeBranch\s*\|\|\s*projectData\?\.linkedBranch\s*\|\|\s*["']main["']/);
  });

  test("Edge validation: Build darf nicht ohne expliziten branch/ref", () => {
    const src = read("supabase/functions/_shared/validation.ts");
    expect(src).not.toMatch(/ref:\s*br\.value\s*\|\|\s*["']main["']/);
  });

  test("Build-Screen bleibt ohne main fallback", () => {
    const src = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");
    expect(src).not.toMatch(/\|\|\s*["']main["']/);
  });

  test("GitHub branchOps: default_branch darf nicht blind zu main fallen", () => {
    const src = read("infra/github/branchOps.ts");
    expect(src).not.toMatch(/default_branch\s*\|\|\s*["']main["']/);
  });
});
```

---

## Größte Contract-Brecher (Top 3)

1. `project/services/buildStartService.ts`  
   Kritischster Pfad vor Edge-Build-Trigger; enthält reale `main`-Fallbacks trotz Contract-Verbot.

2. `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`  
   User-nahe Build/Link-Flow-Logik mit branch-Defaulting auf `main`; erzeugt stilles Fehlverhalten.

3. `contexts/GitHubContext.tsx` (+ Dual-Write in `AppInfo`/Repo-Screen)  
   Doppelter Zustand (`active*` und `linked*`) bleibt Drift-Quelle; ohne starke Integrationstests schwer regressionssicher.


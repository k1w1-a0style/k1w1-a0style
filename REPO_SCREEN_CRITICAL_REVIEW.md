# RepoScreen Critical Review (GitHubReposScreen)

**Datum:** 2026-02-10

## Kurzfazit

- Der RepoScreen ist funktional solide aufgebaut (Hook + Section-Komponenten), hat aber mehrere relevante Konsistenz- und Race-Condition-Risiken.
- Der kritischste Flow-Fehler: Auswahl eines Repos über „Zuletzt genutzt“ umgeht Teile der Selektionslogik (linkedRepo/Branch-Konsistenz).
- Branch-Ladevorgänge sind nicht gegen konkurrierende Requests abgesichert; schnelle Repo-Wechsel können inkonsistente UI-/State-Zustände erzeugen.
- Mehrere asynchrone Aktionen sind nicht vollständig gegen Double-Submit geschützt (insb. Manage-Modal).
- Sicherheitsniveau ist insgesamt okay (Token in SecureStore), aber Input-Härtung für Repo-Identifier ist nicht strikt genug.
- Performance ist bei großen Repo-Listen riskant, weil im ScrollView ohne Virtualisierung gerendert wird.
- Testabdeckung für den Repo-Flow ist praktisch nicht vorhanden; zentrale User-Journeys sind ungesichert.

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| RS-001 | P1 | Correctness | „Recent Repo“-Auswahl setzt nur `activeRepo`, nicht den vollständigen Select-Flow (linkedRepo/Branch/UI-Reset), dadurch inkonsistenter Zustand möglich. | `screens/GitHubReposScreen/components/FilterSection.tsx:28-31`, `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts:216-225` |
| RS-002 | P1 | Correctness / Race | BranchSelector hat keine Cancellation/Request-Guards; bei schnellem Repo-Wechsel können veraltete Requests spätere States überschreiben. | `screens/GitHubReposScreen/components/BranchSelector.tsx:32-62` |
| RS-003 | P1 | Correctness / UX-Safety | Manage-Modal bestätigt Aktionen ohne Busy-Lock; Double-Tap kann Branch-Operationen mehrfach auslösen. | `screens/GitHubReposScreen/index.tsx:261-270` |
| RS-004 | P2 | Correctness / Lifecycle | Refresh-Handler setzt State nach await ohne Unmount-Guard; potenzielles Set-State-after-unmount-Warnverhalten. | `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts:209-214` |
| RS-005 | P2 | Security/Hardening | `splitFullName` validiert Repo-Identifier nicht strikt (ignoriert zusätzliche Pfadsegmente), was Robustheit gegenüber manipulierten Persistenzwerten schwächt. | `screens/GitHubReposScreen/utils/repos.ts:4-11` |
| RS-006 | P2 | Performance | Repo-Liste rendert per `.map()` in ScrollView statt Virtualisierung; bei vielen Repos drohen unnötige Renderkosten/Jank. | `screens/GitHubReposScreen/components/RepoListSection.tsx:44-53` |
| RS-007 | P2 | Maintainability / Typing | `useGitHubReposScreen` bündelt viele Verantwortlichkeiten und nutzt mehrfach `any`; erschwert sichere Weiterentwicklung und Fehlergrenzen. | `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts:232-256`, `:270`, `:352-383` |
| RS-008 | P2 | Tests | Für RepoScreen-/Repo-Flow-relevante Logik fehlen dedizierte Tests (Selektion, Branch-Race, Delete/Rename/Create-Journeys). | `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`, `screens/GitHubReposScreen/components/*` |

---

## RS-001 – Inkompletter Select-Flow bei „Recent Repo“

### Problem
Die Recent-Pills rufen `setActiveRepo(r)` direkt auf. Der zentrale Selektions-Flow (`handleSelectRepo`) macht aber zusätzliche Schritte: `setLinkedRepo(repo.full_name, null)`, `setActiveBranch(null)`, UI-Reset (`showRepoList`, `showRenameRepo`, `showNewRepo`) und Progress-Reset.

### Impact
State kann auseinanderlaufen:
- `activeRepo` geändert, aber `linkedRepo/linkedBranch` im ProjectContext bleibt ggf. alt.
- `activeBranch` kann aus vorherigem Repo weiterleben.
- Folgefehler in Push/Pull/Branch-Operationen möglich (falscher Branch-Kontext).

### Repro-Szenario
1. Repo A auswählen, Branch `feature/x` setzen.
2. Über „Zuletzt genutzt“ Repo B antippen.
3. Prüfen: Branch-/Link-State kann auf alten Werten verbleiben.

### Empfehlung
Recent-Auswahl auf denselben zentralen Selektionspfad umstellen wie Listenauswahl (Single Source of Truth für Repo-Selection).

---

## RS-002 – Race Condition beim Branch-Laden

### Problem
`useEffect` in `BranchSelector` startet async Laden bei `activeRepo`-Änderung, hat aber weder Abort-Mechanismus noch Request-Token/Generation-Check.

### Impact
Bei schnellem Repo-Wechsel kann der ältere Request später zurückkommen und Branch-Liste/defaultBranch für das falsche Repo setzen.

### Repro-Szenario
1. Sehr schnell zwischen zwei Repos wechseln.
2. Netz simuliert langsam.
3. Branch-UI zeigt zeitweise falsche Liste oder setzt unerwartet Branch.

### Empfehlung
Request-Guard ergänzen (AbortController/Generation-ID) und nur Resultate der jüngsten Anfrage übernehmen.

---

## RS-003 – Double-Submit in Manage-Modal

### Problem
Bestätigungsbutton im Manage-Modal bleibt während laufender async-Action aktiv.

### Impact
Mehrfaches Tippen kann mehrere API-Calls auslösen (z. B. Branch erstellen/umbenennen/löschen), was zu inkonsistenten States/Fehler-Alerts führt.

### Repro-Szenario
1. Manage öffnen → „Branch erstellen“.
2. Confirm mehrfach schnell tippen.
3. Mehrfachanfragen/Fehlerdialoge möglich.

### Empfehlung
Modal-lokalen Busy-State einführen, Confirm während Request deaktivieren, idempotentes Handling für wiederholte Eingaben sicherstellen.

---

## RS-004 – Refresh ohne Unmount-Schutz

### Problem
`handleRefresh` setzt `refreshing` vor und nach `await loadRepos()`, ohne zu prüfen, ob Komponente noch gemountet ist.

### Impact
In schnellen Navigationswechseln können React-Warnungen auftreten oder unnötige State-Transitions passieren.

### Empfehlung
Unmount-Guard / cancellable refresh pattern ergänzen.

---

## RS-005 – Repo-Identifier Parsing zu tolerant

### Problem
`splitFullName` akzeptiert effektiv jedes `owner/repo/...`-Format und verwendet nur die ersten zwei Segmente.

### Impact
Manipulierte Persistenzwerte/unerwartete Eingaben werden nicht frühzeitig abgewiesen; Robustheit und Vorhersagbarkeit sinken.

### Empfehlung
Striktes Format erzwingen (`exactly one slash`, kein Leerraum am Rand, keine zusätzlichen Segmente) und Eingaben zentral validieren.

---

## RS-006 – Nicht-virtualisierte Repo-Liste

### Problem
Repo-Liste wird per `.map()` im umgebenden ScrollView gerendert.

### Impact
Bei größeren Listen (z. B. 100 Repos) steigt initiale Renderlast, Re-Render-Kosten und Memory-Nutzung.

### Empfehlung
Layout so umstellen, dass Virtualisierung möglich ist (z. B. Section/FlatList als primärer Scroll-Container).

---

## RS-007 – Hohe Komplexität & Typunsicherheit im Screen-Hook

### Problem
`useGitHubReposScreen` vereint sehr viele Verantwortlichkeiten (Token, Repo CRUD, Push/Pull, Branch-Management, Workflow, EAS-Linking, Modal-Flow) und enthält mehrere `any`-Stellen.

### Impact
- Höheres Regressionsrisiko.
- Schwerer testbar.
- Contracts sind unklarer (Error-/Data-Formate).

### Empfehlung
Hook in domänenspezifische Sub-Hooks aufteilen (Selection, Repo CRUD, Branch Ops, Sync/PushPull) und `any` durch klar typisierte DTOs ersetzen.

---

## RS-008 – Fehlende Repo-Flow-Tests

### Problem
Kritische Flows sind nicht durch dedizierte Tests abgesichert.

### Impact
Race-/Konsistenzbugs bleiben leicht unentdeckt.

### Empfehlung
Gezielt wertstiftende Integrations-/Hook-Tests für zentrale Journeys ergänzen (siehe „Test Suggestions“).

---

## Quick Wins (max. 10)

1. Recent-Pill Auswahl auf zentralen `handleSelectRepo`-Flow umleiten.
2. Manage-Modal Confirm während laufender Aktion deaktivieren.
3. BranchSelector mit Request-Generation-Guard absichern.
4. `handleRefresh` gegen Unmount absichern.
5. `splitFullName` strict machen (genau 2 Segmente).
6. Einheitliche Error-Surface für Repo-Aktionen definieren (statt ad-hoc Alerts).
7. `any`-Nutzung in Hook-Rückgabewerten reduzieren.
8. Telemetrie/Debug-Logs für wiederholte API-Fehler konsolidieren (ohne sensitive Inhalte).

## Optional Improvements

- Repo-Liste für Skalierung auf virtualisierte Struktur umbauen.
- RepoFlow als State-Machine modellieren (idle/loading/success/error pro Aktion).
- Branch-/Repo-Operationen mit dedizierter Command-Layer kapseln (bessere Retry-/Abort-Strategien).
- Konsistenzcheck beim App-Start: persistiertes `activeRepo/activeBranch` gegen aktuelle Repo-Liste validieren.

## Test Suggestions (1–5)

1. **Selection Consistency Test:** Auswahl aus Repo-Liste vs. Recent-Pill muss identische Side-Effects haben (`activeRepo`, `activeBranch`, `linkedRepo`, UI-Flags).
2. **Branch Race Test:** Bei schnellem `activeRepo`-Switch dürfen nur Branches des zuletzt gewählten Repos im State landen.
3. **Manage Modal Idempotency Test:** Mehrfachklick auf Confirm löst maximal eine Branch-API-Aktion aus.
4. **Refresh Lifecycle Test:** Kein State-Update nach Unmount während laufendem Refresh.
5. **Repo Identifier Validation Test:** Ungültige FullNames (`owner/repo/extra`, leere Segmente, whitespace-only) werden sicher abgewiesen.


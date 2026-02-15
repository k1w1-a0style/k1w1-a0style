# Vollständiger Refactoring-Plan (nur Planung, keine Code-Änderungen)

## 1. Ziel & Rahmen

Dieses Dokument beschreibt einen **vollständigen, umsetzbaren Refactoring-Plan** für das Projekt, ohne funktionale Änderungen am Produktverhalten zu erzwingen.

Leitlinien:
- Kleine, sichere Schritte (iterative PRs)
- Kein Big-Bang-Rewrite
- Build-/Workflow-Verträge bleiben stabil
- Jede Phase ist testbar und rückrollbar

---

## 2. Projektstatus (Ist-Analyse)

### 2.1 Stärken
- Solider Qualitäts-Gate-Stack vorhanden (`typecheck`, `lint:ci`, `test:silent`).
- Breite Testabdeckung in Kernmodulen (`lib/__tests__`, `__tests__`).
- Klare Produktdomäne: Build-Orchestrierung, Diagnostics, Repo-Secrets, Chat-AI.

### 2.2 Haupttreiber für Refactoring
- Sehr große, stark gekoppelte Module mit vielen Verantwortlichkeiten:
  - `contexts/ProjectContext.tsx`
  - `contexts/githubService.ts`
  - `lib/diagnostics/preflightChecks.ts`
  - `lib/diagnostics/ciAutoFix.ts`
  - `hooks/useChatAIFlow.ts`
- Erhöhtes Wartungsrisiko durch enge Kopplung von UI, Domain-Logik und Infra.
- Qualitätsregeln (Lint/TS) sind teilweise global gelockert; schrittweise Härtung sinnvoll.

---

## 3. Zielarchitektur (Soll)

Prinzipien:
1. **Schichten trennen**: UI ↔ Hook/State ↔ Domain ↔ Infra
2. **Pure Functions zuerst** in `lib/` und Helpers in `utils/`
3. **Vertikale Feature-Slices** statt monolithischer Sammelmodule
4. **Vertragsstabilität** für Build-/Workflow-Logik

### 3.1 Schichtenmodell
- **UI/Presentation**: `screens/`, `components/`, `styles/`
- **State/Orchestrierung**: schlanke Contexts + spezialisierte Hooks
- **Domain/Core**: reine Logik (validieren, mappen, normalisieren, planen)
- **Infra**: GitHub/Supabase/SecureStore/Datei-I/O

---

## 4. Vollständiger Umsetzungsplan nach Phasen

## Phase 0 — Baseline & Safety-Net

Ziele:
- Verhaltensbaseline sichern, bevor intern umgebaut wird.

Aufgaben:
1. Architekturfluss dokumentieren (Build, Diagnostics, Chat-AI, Secret-Sync).
2. Metriken erfassen: Dateigrößen, Laufzeiten, Fehlercluster.
3. Bestehende Qualitäts-Gates als Pflicht-Checks festlegen.
4. Golden-Path Regressionstests identifizieren:
   - Build anstoßen + Status-Polling
   - Diagnostics ausführen + Fix-Vorschläge
   - Chat-Flow mit Planer/Builder/Apply

Abnahme:
- Baseline-Dokument vorhanden
- Alle Gates grün

---

## Phase 1 — `ProjectContext` entkoppeln

Ziele:
- `contexts/ProjectContext.tsx` auf Kernverantwortung reduzieren.

Aufgaben:
1. Dateioperationen extrahieren:
   - `project/domain/fileOps.ts` (create, rename, delete, merge)
2. Persistenz extrahieren:
   - `project/services/projectPersistence.ts`
3. Build-Polling extrahieren:
   - `project/services/buildPollingService.ts`
   - `project/hooks/useBuildPolling.ts`
4. Template-Handling extrahieren:
   - `project/services/templateService.ts`
5. UI-Alerts aus Domain-/Service-Funktionen entfernen (nur Fehlerobjekte zurückgeben).

Abnahme:
- Context-Datei deutlich kleiner
- Kein Verhaltensunterschied in bestehenden Flows
- Unit-Tests für extrahierte pure Funktionen

---

## Phase 2 — GitHub-Infra modularisieren

Ziele:
- `contexts/githubService.ts` in klaren Infra-Layer aufteilen.

Aufgaben:
1. GitHub HTTP-Client kapseln:
   - `infra/github/client.ts` (Auth-Header, Fehler-Mapping, Retry/Rate-Limit-Hooks)
2. Repo-Dateioperationen trennen:
   - `infra/github/files.ts`
3. Secret-Operationen trennen:
   - `infra/github/secrets.ts` (public key, Verschlüsselung, upsert)
4. Token-Storage entkoppeln:
   - `infra/secure/tokenStore.ts`
5. Bestehende Public-API via Fassade erhalten (kompatibel halten).

Abnahme:
- GitHub-spezifische Tests für Fehlerpfade (401/403/404)
- Keine Änderung am Aufrufverhalten in Screens/Contexts

---

## Phase 3 — Diagnostics auf Modul-Registry umbauen

Ziele:
- Große Diagnostik-Dateien in kleine Check-Module zerlegen.

Aufgaben:
1. Checks in Kategorien trennen:
   - `lib/diagnostics/checks/core/*`
   - `lib/diagnostics/checks/eas/*`
   - `lib/diagnostics/checks/security/*`
   - `lib/diagnostics/checks/workflow/*`
2. Zentrale Registrierung:
   - `lib/diagnostics/checks/registry.ts`
3. Patch-/Fix-Helfer zentralisieren:
   - `lib/diagnostics/patching/*`
4. Workflow-Template-Strings auslagern:
   - `lib/diagnostics/workflows/templates/*`

Abnahme:
- Jeder Check hat isolierte Unit-Tests
- Reihenfolge/Priorität der Checks explizit dokumentiert

---

## Phase 4 — Chat-AI Pipeline segmentieren

Ziele:
- `hooks/useChatAIFlow.ts` in klar getrennte Pipeline-Module aufteilen.

Aufgaben:
1. Planner/Bau-Logik trennen:
   - `chat/pipeline/planner.ts`
   - `chat/pipeline/builder.ts`
2. Validator-/Normalizer-Fluss trennen:
   - `chat/pipeline/validator.ts`
3. Queue-/Concurrency-Handling extrahieren:
   - `chat/pipeline/autofixQueue.ts`
4. Streaming-UI in Hook auslagern:
   - `chat/hooks/useStreamingMessage.ts`
5. Hook `useChatAIFlow` als dünne Orchestrierungs-Fassade belassen.

Abnahme:
- Deterministische Tests für Queue, Retry, Pending-Plan, Apply/Reject
- Kein UI-Verhalten regressiv

---

## Phase 5 — Navigation & App-Composition strukturieren

Ziele:
- `App.tsx` entlasten und besser testbar machen.

Aufgaben:
1. Navigatoren trennen:
   - `navigation/TabNavigator.tsx`
   - `navigation/DrawerNavigator.tsx`
   - `navigation/RootNavigator.tsx`
2. Provider-Baum kapseln:
   - `app/AppProviders.tsx`
3. Start-/Bootstrapping klar trennen:
   - `app/bootstrap.ts`

Abnahme:
- `App.tsx` nur Entry + Komposition
- Navigation-Snapshot-/Smoke-Tests bleiben stabil

---

## Phase 6 — Qualitätsregeln schrittweise verschärfen

Ziele:
- Technische Schulden in Lint/TypeScript kontrolliert abbauen.

Aufgaben:
1. Lint-Regeln folderweise schärfen (kein globaler Schock):
   - `react-hooks/exhaustive-deps`
   - `@typescript-eslint/no-unused-vars`
2. TS-Flags pilotieren in refaktorierten Modulen:
   - `noUncheckedIndexedAccess`
   - `exactOptionalPropertyTypes`
3. Fehlercluster priorisieren, dann schrittweise repo-weit ausrollen.

Abnahme:
- Keine Produktivitätsblocker
- Sinkende Warnungs-/Suppressionsrate pro Sprint

---

## Phase 7 — Repo-Hygiene & Dokumentation

Ziele:
- Struktur konsolidieren, Altlasten reduzieren.

Aufgaben:
1. Alt-/Backup-Dateien prüfen und bereinigen (nach Freigabe).
2. ADRs ergänzen:
   - Context-Schnittstellen
   - Diagnostics-Registry
   - Chat-Pipeline-Design
3. Contribution-Guide um Refactoring-Konventionen ergänzen.

Abnahme:
- Klarere Onboarding-Pfade
- Weniger tote/duplizierte Artefakte

---

## 5. Priorisierung (Roadmap)

### Priorität A (höchster ROI, niedriges Risiko)
1. Phase 1 (`ProjectContext` entkoppeln)
2. Phase 3 (Diagnostics modularisieren)
3. Phase 2 (GitHub-Infra splitten)

### Priorität B
4. Phase 4 (Chat-AI Pipeline)
5. Phase 5 (Navigation/App-Komposition)

### Priorität C
6. Phase 6 (Qualitätsregeln verschärfen)
7. Phase 7 (Hygiene & ADR)

---

## 6. Empfohlene PR-Strategie

- Pro PR genau ein Teilziel, max. 150–400 Nettozeilen Änderung.
- Reihenfolge je Phase:
  1. Extract ohne Verhaltensänderung
  2. Tests ergänzen
  3. Aufrufer umstellen
  4. Tote Pfade entfernen
- Nach jeder PR Pflichtchecks:
  - `npm run typecheck`
  - `npm run lint:ci`
  - `npm run test:silent`

---

## 7. Risiko- und Migrationsmanagement

### Technische Risiken
- Versteckte Seiteneffekte beim Extrahieren aus Context/Hook-Monolithen.
- Regressionsgefahr bei Build-/Polling-Status.
- Prompt-/Normalizer-Drift im Chat-Flow.

### Gegenmaßnahmen
- Golden-Path Tests zuerst.
- Feature-Flag-ähnliche Umschaltung pro neuem Service, wenn nötig.
- Kompatibilitätsfassaden statt harter API-Brüche.

---

## 8. Erfolgsmessung (KPIs)

1. Durchschnittliche Dateigröße in Kernmodulen sinkt signifikant.
2. Höhere Unit-Test-Dichte in Domain-/Infra-Layern.
3. Weniger Hotfixes durch Seiteneffekte.
4. Schnellere Einarbeitung in Teilbereiche (subjektiv + objektiv über PR-Dauer).

---

## 9. Ziel-File-Tree (Refactoring-Zielbild)

```text
.
├─ app/
│  ├─ AppProviders.tsx
│  └─ bootstrap.ts
├─ navigation/
│  ├─ RootNavigator.tsx
│  ├─ DrawerNavigator.tsx
│  └─ TabNavigator.tsx
├─ project/
│  ├─ domain/
│  │  ├─ fileOps.ts
│  │  ├─ projectMutations.ts
│  │  └─ buildStateMapper.ts
│  ├─ services/
│  │  ├─ projectPersistence.ts
│  │  ├─ templateService.ts
│  │  └─ buildPollingService.ts
│  └─ hooks/
│     └─ useBuildPolling.ts
├─ chat/
│  ├─ pipeline/
│  │  ├─ planner.ts
│  │  ├─ builder.ts
│  │  ├─ validator.ts
│  │  └─ autofixQueue.ts
│  └─ hooks/
│     └─ useStreamingMessage.ts
├─ infra/
│  ├─ github/
│  │  ├─ client.ts
│  │  ├─ files.ts
│  │  └─ secrets.ts
│  └─ secure/
│     └─ tokenStore.ts
├─ lib/
│  └─ diagnostics/
│     ├─ checks/
│     │  ├─ core/
│     │  ├─ eas/
│     │  ├─ security/
│     │  ├─ workflow/
│     │  └─ registry.ts
│     ├─ patching/
│     │  ├─ patchBuilders.ts
│     │  └─ jsonMerge.ts
│     └─ workflows/
│        └─ templates/
├─ contexts/
│  ├─ ProjectContext.tsx         (deutlich schlanker)
│  └─ githubService.ts           (Kompatibilitätsfassade)
└─ Refactoring.md
```

---

## 10. Nicht-Ziele (bewusst ausgeschlossen)

- Keine Dependency-Upgrades innerhalb dieses Refactoring-Plans.
- Kein visuelles Re-Design.
- Keine Änderung von Produktfeatures oder Workflow-Verträgen.
- Kein globales Auto-Formatting über das gesamte Repo.

---

## 11. Freigabe-Checkliste vor Start

- [ ] Plan freigegeben
- [ ] PR-Reihenfolge priorisiert
- [ ] Verantwortlichkeiten pro Phase geklärt
- [ ] Teststrategie je Phase festgelegt
- [ ] Rollback-Strategie je Phase dokumentiert


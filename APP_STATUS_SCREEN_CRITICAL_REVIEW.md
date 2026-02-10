# AppStatusScreen Critical Review

**Datum:** 2026-02-10

## Kurzfazit
- Der `AppStatusScreen` ist funktional klar aufgebaut, aber die Status-/Validierungslogik im Hook ist aktuell relativ fragil gegenüber realen Expo-Projektvarianten (`app.json`, `app.config.ts`, dynamische Config). 
- Es gibt keine Polling-, Timer- oder Subscription-Logik im untersuchten Scope; damit entfallen zwar Cleanup-Risiken, aber auch Live-Status-Fähigkeiten (falls fachlich gewünscht).
- Typisierung ist in zentralen Teilen aufgeweicht (`any`, nachträgliche Type-Assertions), wodurch Laufzeitfehler und inkonsistente Daten leichter durchrutschen.
- Bei großen Projekten drohen UI-Performanceprobleme (line count über alle Dateien, unvirtualisierte Listen in `ScrollView`).
- Testabdeckung für den AppStatus-Flow fehlt praktisch vollständig (insbesondere Edgecases/Parsing/False-Positives).

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| F-001 | P1 | Correctness / API Contract | Konfigurationsprüfung ist auf `app.config.js` + Regex-Parsing fixiert; valide Expo-Konfigurationen werden fälschlich als Fehler markiert. | `screens/AppStatusScreen/hooks/useAppStatusScreen.ts:64-101` |
| F-002 | P1 | Correctness | Entry-Point-Check ist zu starr (`App.tsx` only) und produziert False Positives bei legitimen Setups (z. B. `index.js`, `src/App.tsx`). | `screens/AppStatusScreen/hooks/useAppStatusScreen.ts:104-112` |
| F-003 | P2 | Typing / Maintainability | Mehrere `any`-Typen + Casts im Return maskieren Datenprobleme und schwächen Verträge zwischen Hook und UI. | `screens/AppStatusScreen/hooks/useAppStatusScreen.ts:35,38-39,215-219`; `screens/AppStatusScreen/components/OverviewSection.tsx:12` |
| F-004 | P2 | Performance | Potenziell teure Berechnungen und unvirtualisierte Listen im Render-Flow für große Projekte (`totalLines`, Dependency-/File-Listen). | `screens/AppStatusScreen/hooks/useAppStatusScreen.ts:137-140,163-174`; `screens/AppStatusScreen/components/DependenciesSection.tsx:26-34`; `screens/AppStatusScreen/components/FilesSection.tsx:23-42`; `screens/AppStatusScreen/index.tsx:68` |
| F-005 | P3 | Rendering Robustness | Listen verwenden Index-Keys, was bei Reordering/Insertions zu instabilen Re-Renders führen kann. | `screens/AppStatusScreen/components/DependenciesSection.tsx:27`; `screens/AppStatusScreen/components/FilesSection.tsx:24,32`; `screens/AppStatusScreen/components/ValidationSection.tsx:20` |
| F-006 | P2 | Tests | Keine dedizierten Tests für `AppStatusScreen`/`useAppStatusScreen` (Parsing, Edgecases, große Datenmengen, False Positives). | `__tests__/` (kein direkter Treffer für AppStatus) |

---

## Detailanalyse

### F-001 – Fragiles Expo-Config-Parsing (P1)
**Problem**  
Die Logik sucht ausschließlich nach `app.config.js` und extrahiert Felder per Regex (`name`, `package`, `owner`). Moderne/zulässige Varianten wie `app.json`, `app.config.ts`, dynamische Exporte oder verschachtelte/formatierte Objekte können dadurch als fehlerhaft gelten, obwohl das Projekt korrekt ist.

**Impact**  
- Falsche Error-States in der Status-UI (`app.config.js fehlt`, `Android Package Name fehlt`).
- Vertrauensverlust in die Validierungsanzeige (False Positives).

**Repro-Szenario**  
Projekt nutzt nur `app.json` oder `app.config.ts` mit gültigem `expo.android.package`; Screen zeigt dennoch Fehler.

**Empfehlung**  
- Validierung auf mehrere Config-Quellen ausweiten (`app.json`, `app.config.js`, `app.config.ts`) in definierter Priorität.
- Statt Regex mindestens JSON-Pfad-basiertes Lesen für `app.json`; für JS/TS klar dokumentierte Fallback-Strategie (z. B. best-effort + "nicht sicher validierbar" statt Hard-Error).
- Fehlerklassifikation differenzieren: „nicht gefunden“ vs. „nicht parsebar“ vs. „nicht validierbar“.  

### F-002 – Zu starrer Entry-Point-Check (P1)
**Problem**  
Der Screen verlangt explizit `App.tsx`. Viele legitime React-Native/Expo-Setups nutzen andere Entry-Muster.

**Impact**  
False Positive „App.tsx fehlt“, obwohl Build lauffähig ist.

**Repro-Szenario**  
Projekt mit `index.js` + `registerRootComponent`, oder Struktur mit `src/App.tsx`.

**Empfehlung**  
- Entry-Point-Validierung an realen Expo/RN-Konventionen ausrichten (z. B. `package.json.main`, `index.*`, alternative App-Pfade).
- Falls keine eindeutige Erkennung möglich ist: Warnung statt Fehler.

### F-003 – Schwacher Typvertrag im Kern-Hook (P2)
**Problem**  
`pkgData`, `deps`, `devDeps`, `projectData` sind teilweise `any`; zusätzlich werden Rückgabewerte auf Zieltypen gecastet.

**Impact**  
- Typfehler werden vom Compiler schlechter erkannt.
- UI kann inkonsistente Daten bekommen, ohne dass dies früh auffällt.

**Empfehlung**  
- `any` durch konkrete Interfaces ersetzen (`PackageJsonLike`, `ProjectData` aus Context-Typen).
- Type-Assertions im Return vermeiden; lieber strikt typisierte Defaults und Narrowing im Hook.

### F-004 – Skalierungsrisiko bei größeren Projekten (P2)
**Problem**  
- `totalLines` traversiert alle Dateien und splitet jeden Inhalt in Zeilen.
- Dependencies und Files werden vollständig in `ScrollView` gerendert (ohne Virtualisierung).

**Impact**  
- UI-Jank/Frame-Drops bei großen Projekten.
- Erhöhte Memory-Last durch große Listen.

**Empfehlung**  
- Listen auf `FlatList`/`SectionList` umstellen.
- Potenziell schwere Berechnungen kapseln und ggf. begrenzen (z. B. line count nur für Textdateien / mit Cutoff).
- Optional „large project mode“ mit reduziertem Detailgrad.

### F-005 – Instabile List Keys (P3)
**Problem**  
Mehrere Listen verwenden `index` als Key.

**Impact**  
Bei Einfügungen/Reihenfolgeänderungen können unnötige Re-Renders bzw. inkonsistente Item-Reuse-Effekte auftreten.

**Empfehlung**  
- Stabile Schlüssel verwenden (`dep.name`, `dir`, `file`, eindeutige Kombinationen).

### F-006 – Fehlende Tests für Status/Validation-Flow (P2)
**Problem**  
Im Testbestand sind keine dedizierten Tests für `AppStatusScreen`/`useAppStatusScreen` erkennbar.

**Impact**  
Regressionsrisiko bei Parser-/Validierungsänderungen ist hoch, insbesondere bei den oben genannten False-Positive-Szenarien.

**Empfehlung**  
- Unit-Tests auf Hook-Ebene + ein kompakter Integrationstest für den Screen.

---

## Quick Wins (max. 10)
1. File-Detection um `app.json` ergänzen (zusätzlich zu `app.config.js`).
2. Entry-Point-Check toleranter machen (`App.tsx` nicht als einziges Kriterium).
3. `projectData` in `OverviewSection` strikt typisieren statt `any`.
4. `any` für `pkgData/deps/devDeps` durch kleine lokale Typen ersetzen.
5. Index-Keys in allen AppStatus-Listen durch stabile Keys ersetzen.
6. Bei nicht parsebarer Config eher `warning` statt `error` anzeigen, wenn Build-Fähigkeit unklar ist.
7. Validierungsfehler differenzierter formulieren (Quelle/Datei/Grund).
8. Zeilenzählung für sehr große Dateien limitieren oder lazy berechnen.
9. Dependency-/Dateiliste schrittweise virtualisieren.
10. Hook-Logik in testbare Helper auslagern (Parser/Validator getrennt).

## Optional Improvements
- Validierungsergebnisse mit Confidence-Level versehen (z. B. „sicher“, „heuristisch“, „unbestätigt“).
- UX: Kurze Erklärung, dass die Checks statisch sind und keinen Live-Health/Polling-Status darstellen.
- Internationalisierung der statischen Strings (falls i18n-Strategie existiert).

## Test Suggestions (1–5)
1. **Hook Unit Test:** `app.json`-only Projekt → kein False-Error „app.config.js fehlt“.  
2. **Hook Unit Test:** Projekt mit `index.js`/alternativem Entry → keine harte Fehlermeldung „App.tsx fehlt“.  
3. **Hook Unit Test:** kaputtes `package.json` → genau ein parse-bezogener Fehler, keine Folgefehler-Kaskade.  
4. **Component Test:** große Dependency-/File-Mengen (z. B. 1k Items) → Screen bleibt renderbar, keine Timeouts.
5. **Regression Test:** stabile Keys verifizieren (List-Rerender bei Insert/Reorder ohne falsches Item-Reuse).

---

## Scope-Notiz (wichtig)
Im direkt untersuchten AppStatus-Scope wurden **keine** Polling-/Timer-/Subscription-Mechanismen gefunden; daher existieren dort auch keine Cleanup-/Lifecycle-Bugs dieser Kategorie. Die Hauptprobleme liegen in statischer Validierungslogik, Typvertrag und Skalierung.

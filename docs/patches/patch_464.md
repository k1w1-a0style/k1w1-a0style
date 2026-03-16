# Patch 464 — GitHubReposScreen Defensivfix für malformed `project.files`

## Ziel
Kleiner Nachfix im bereits gehärteten GitHubReposScreen: Legacy-/Storage-Daten mit ungültigen Einträgen (z. B. `null` in `project.files`) dürfen den Screen beim Normalisieren/Iterieren nicht mehr crashen.

## Änderungen
- `screens/GitHubReposScreen/utils/projectFiles.ts`
  - Neuen, strikt getypten Helper `normalizeProjectFiles(files: unknown): ProjectFile[]` ergänzt.
  - Filtert defensiv alle ungültigen Einträge (`null`, primitive Werte, Objekte ohne string-`path`, leere `path`-Strings).
  - Behält Typing-Richtung bei (kein `any[]`-Fallback), normalisiert `path` (`trim`) und `content` robust auf String.
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
  - Lokale Dateien laufen jetzt zentral über `normalizeProjectFiles(projectData?.files)`.
  - Push-/Selection-Pfade (`handlePush`, `openPushModalForPaths`, `confirmPushSelected`) nutzen ausschließlich die bereits validierte Liste.
  - Kein Broad Refactor, nur gezielter Austausch der lokalen Datei-Quelle.
- `__tests__/projectFiles.normalize.regression.test.ts`
  - Gezielte Regression ergänzt: `project.files` mit `null`/malformed Einträgen wird gefiltert; valide Dateien bleiben erhalten.
- `__tests__/patch462.githubReposScreen.restFixes.invariants.test.ts`
  - Invariant für den Root-Fix auf den neuen typed Normalizer angepasst.

## Nicht Teil dieses Patches
- Kein Umbau von ProjectContext-/Storage-Architektur.
- Keine Änderungen an Repo-/Branch-SoT oder Pull/Sync-Architektur.

# Patch 523 — GitHubRepoScreen Push-/Pull-Hardening im Repo-Infra-Scope

## Ziel

Zwei verbleibende kleine Hardening-Punkte im GitHubRepoScreen-/Infra-Scope werden ohne
Architekturumbau geschlossen:

1. lokale Repo-Pfade mit Traversal-Segmenten `..` duerfen im Push-Pfad nicht mehr akzeptiert
   werden
2. der Pull-Pfad soll fuer sehr grosse Repos einen harten, ehrlichen Cap fuer geladene
   Textdateien haben, damit nicht unbegrenzt Blob-Inhalte in den App-Memory gezogen werden

## Root Cause

- `infra/github/utils.ts` normalisierte bisher nur Slash-Richtung und entfernte ein fuehrendes
  `./`, liess aber `..`-Segmente in Repo-Pfaden stehen.
- `hooks/useGitHubRepos.ts` filterte zwar auf erlaubte Textdateien und lud diese effizient per
  GraphQL-Batches plus REST-Fallback, hatte aber keinen harten globalen Pull-Cap. Sehr grosse
  Repos konnten deshalb weiterhin alle erlaubten Text-Blobs in den Client ziehen.

## Umsetzung

1. `infra/github/utils.ts`
   - `normalizeRepoPath()` normalisiert weiter `\` zu `/`
   - entfernt weiter fuehrende `./`
   - gibt jetzt aber einen leeren String zurueck, sobald ein Segment exakt `..` ist
2. `infra/github/files.ts`
   - `pushFilesToRepoAdvanced(...)` behandelt einen nicht-leeren Originalpfad, der nach
     `normalizeRepoPath(...)` ungueltig wird, jetzt als klaren Fehler:
     `Ungültiger Repo-Pfad: ...`
   - der bestehende Managed-Workflow-Guard bleibt unveraendert aktiv
3. `hooks/useGitHubRepos.ts`
   - fuehrt `MAX_PULL_TEXT_FILES = 200` als harten Cap fuer erlaubte Pull-Textdateien ein
   - wenn der gefilterte Tree groesser ist, wird der Pull vor GraphQL-/Blob-Ladevorgaengen mit
     einer ehrlichen Fehlermeldung abgebrochen
4. `__tests__/githubRepoInfra.hardening.test.ts`
   - deckt Traversal-Block, normalen Push inkl. Workflow-Guard, Pull-Cap und normalen Pull ab

## Tests / Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Risiko / Scope

- Kein Umbau an Secret-Sync, Workflow-Dispatch, CI-Lite, Build oder Auth-Architektur.
- Kein neuer API-Layer.
- `Authorization: token ...` im Hook wurde bewusst **nicht** mitgezogen, um den Scope strikt auf
  Push-/Pull-Hardening zu begrenzen.

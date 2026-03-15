# Patch 446

Datum: 2026-03-15

## Ziel
Letzten flow-kritischen `any`-Restpunkt im Build-Start-Pfad (`project/services/buildStartService.ts`) konservativ reduzieren und Edge-Payload-Mapping für Job-ID/Fehler robust typisieren – ohne Broad-Refactor.

## Änderungen
- **`project/services/buildStartService.ts`**
  - Lokalen Payload-Typ `EdgeBuildInvokePayload` ergänzt (nur benötigte Felder: `ok`, `error`, `details.message`, `jobId`/`job_id`/`job.id`).
  - Neue Narrowing-Helferfunktion `asEdgeBuildInvokePayload(raw: unknown)` eingeführt, damit Edge-Responses strukturiert statt per mehrfacher `as any`-Casts gelesen werden.
  - `pushFilesToRepo(owner, repo, files as any, branch)` auf typisierten Aufruf ohne Cast umgestellt (`files`).
  - `invokeOpts.body` von `any` auf `Record<string, string>` eingegrenzt.
  - Fehlerpfad (`ok === false`) und Job-ID-Auflösung laufen nun über das narrowte Payload-Objekt; Laufzeitverhalten bleibt gleich, aber Type-Safety ist ehrlicher.

- **`__tests__/buildStartService.edgePayloadTyping.test.ts`**
  - Neue gezielte Regression: akzeptiert `job.id` als numerische Job-ID und mapped korrekt auf String-`jobId`.
  - Neue gezielte Regression: error-shaped Payload (`ok: false`, `details.message`) führt deterministisch zum geworfenen Fehler.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Hinweis
Bewusst kein Massen-Cleanup: nur ein bestätigter Build-/Edge-naher `any`-Hotspot plus lokale Regressionen, verbleibende nicht-kritische `any`-Stellen bleiben als selektiver Follow-up im TODO.

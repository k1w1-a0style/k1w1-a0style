# k1w1-a0style

## Schnellstart Doku

- Einstieg / Navigationsknoten: `docs/INDEX.md`
- Operatives Gesamtbild: `docs/00-overview.md`
- Offene Punkte (laufend): `docs/TODO.md`
- Patch-Ablauf: `docs/WORKFLOW_PATCHING.md`
- Patchlog (append-only): `docs/patches/PATCHLOG_ROOT.md`
- Kurz-Checklog (laufend): `PROJECT_CHECKLOG.md`

## Aktueller Stand (kompakt)

- Zuletzt abgeschlossen: **Patch 425**.
- Workflow-/CI-Lite-SoT ist nach 393A–417 konsolidiert; Drift-Guards und Invariants sind dafür etabliert.
- Build-Job-Vertrag ist auf **positive numerische `jobId`** (bigint-backed) ausgerichtet; UUID-Annahmen sind entfernt.
- Diagnostics-Upload-ID wird clientseitig als **opaque string** behandelt; SQL-Seite bleibt bigint-backed.
- Service-Role-Handling ist aus Client-Pfaden entfernt; CI-/Workflow-Pfade laufen über explizite Guards.
- Patch 415 V3 bleibt als Vertragsanker relevant: workflow-/CI-nahe Edge-Pfade nutzen gemeinsamen Admin-/CI-Bearer-Guard.

## Operative Leitplanken

- Vor Workflow-/Template-Änderungen immer zuerst: `bash scripts/check_workflow_template_drift.sh`
- Für Workflow↔Edge-Verträge zusätzlich: `bash scripts/check_workflow_edge_contracts.sh`
- Branch-basierte CI-Lite-Chain bleibt eine **bewusste Ausnahme** und ist dokumentiert (kein stiller Default-Branch-Fallback in produktiven Deploy-Flows).

## Patch-Hinweis (ZIP-Workflow)

Bei Patch-ZIPs immer:
1. ZIP ins Projektroot legen
2. entpacken
3. ZIP direkt wieder löschen
4. Patch anwenden
5. `npm run typecheck`, `npm run lint:ci`, `npm run test:silent`
6. erst dann commit + push

> Historische Detailänderungen stehen bewusst in `docs/patches/PATCHLOG_ROOT.md` und den einzelnen `docs/patches/patch_*.md`-Notizen.

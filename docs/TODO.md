# TODO

Stand: **2026-03-12**

Dieses Dokument ist die **laufende Restliste**. Historische, bereits erledigte Patch-Aufgaben liegen in den Patch-Notizen unter `docs/patches/`.

## Aktuell offen (operativ)

- [ ] Repo-weiten MD-/Notes-Cleanup nachziehen (zweite Runde): verbleibende Redundanzen außerhalb der Kern-MDs prüfen und konsolidieren.
- [ ] Dokument-SoT weiter schärfen: klar markieren, welche Kern-MDs normativ sind und welche rein Archivfunktion haben.
- [ ] Trust-Follow-up dokumentieren: frischer Checkout + `npm ci` + `typecheck` + `lint:ci` + `test:silent` als reproduzierbarer Green-Path.
- [ ] Repo-weites SoT-Follow-up: zusätzliche Invariants/Jest-Guards für branch-/ref-gesteuerte Workflow-Pfade prüfen.
- [ ] CI-Lite-Chain bleibt bewusst branch-basiert (dokumentierte Ausnahme zur ref-zentrierten Workflow-SoT); bei Follow-up-Patches explizit erhalten und gegen Drift testen.
- [ ] Hardening-Reminder: `Number(jobId)` bei sehr großen bigint-Werten separat evaluieren.
- [ ] Hardening-Reminder: UUID-Kompatibilitätsregex in `normalizeDiagnosticUploadId()` später enger ziehen/entfernen, sobald der Upload-ID-Typ final ist.
- [ ] Hardening-Reminder: verbleibende Edge-Pfade auf explizite Admin-/CI-Guards prüfen.
- [ ] Hardening-Reminder: langfristig privilegierte CI-Secrets weiter reduzieren (weg vom breiten Service-Role-Einsatz).

## Kürzlich abgeschlossen
- [x] Patch 419 — konservativer MD-/Notes-Cleanup in den Kern-MDs.
- [x] Patch 418 V1 — Trust-/Docs-Konsolidierung, offene Follow-ups gesammelt.
- [x] Patch 417 V18 — Delivery-Artefakt-Bereinigung + `.gitignore`-Schutz für Patch-Bundles.
- [x] Patch 416 — Legacy-Edge-Deaktivierung in Config + Guard-/Invariant-Coverage.
- [x] Patch 415 V3 — gemeinsamer Admin-/CI-Bearer-Guard für workflow-/CI-nahe Edge-Pfade.
- [x] Patch 414 V13 — Ref-SoT-Invariants für Workflow-/Template-Pfade gehärtet.

## Archiv-Hinweis
- Frühere, erledigte TODO-Blöcke wurden bewusst aus der operativen Ansicht entfernt.
- Referenz für Historie: `docs/patches/PATCHLOG_ROOT.md` und die jeweiligen `docs/patches/patch_*.md`.

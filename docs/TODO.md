# TODO

Stand: **2026-04-02 (Docs Konsolidierung)**

> Kompakte Restpunkt-/Betriebs-SoT. Keine historische Backlog-Sammlung.

## Aktueller Status

Im aktuell geprueften Repo-Stand gibt es **keine offenen Repo-Muss-Punkte**, die hier als aktive TODO gefuehrt werden muessen.

- **Supabase-/Operator-Runbook-Restpunkt geschlossen**

## Externe Betriebs-Restpunkte (bewusst ausserhalb Repo-Code)


- externes `build_admin`-Provisioning
- produktive Secret-Rotation / Dashboard-Setup
- Live-/Staging-Verifikation gegen echte Zielumgebungen
- optionale Produktarbeit wie Wizard, Streaming, groessere UX- oder Refactor-Vorhaben

Das sind reale Aufgaben, aber **keine offenen Repo-Code-/Doku-Defekte**.

## Geparkt (spaeter): Chat-Guard-UX/Policy-Sichtbarkeit

> Stand 2026-04-02: bewusst geparkt, nicht Teil des aktuellen Fix-Durchlaufs.

### P0 (direkt sinnvoll, aber vertagt)
- Guard-Badge im Chat-Kopf/Composer (Kurzstatus: "Normal write" vs. "Guarded path enthalten")
- ✅ Pre-Apply Guard-Hinweis im Confirm-Modal inkl. Grund (`kritisch/manual-only`, `baseline/read-only`) (Patch 709)
- Einmalige Planner-Info: "Diese Teile kann ich im Chat nicht direkt schreiben"

### P1 (starke UX-Verbesserung, vertagt)
- Path-Chips in der Planung ("wird geändert" vs. "manuell nötig")
- Structured Follow-up bei Guarded-Pfaden (safe Alternativen A/B anbieten)

### P2 (Governance/Robustheit, vertagt)
- Policy-Explain-Drawer (Warum Guards + Beispiele)
- Lokale Audit-Telemetrie für Guard-Blocker-Häufigkeit

## Wofuer diese Datei bleibt

- als kleine, ehrliche Restpunkt-SoT
- als schneller Check, ob gerade wirklich etwas offen ist
- als bewusste Gegenmassnahme gegen Drift durch grosse historische Sammellisten

## Verbindliche Begleitquellen

- `docs/reviews/Review.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`

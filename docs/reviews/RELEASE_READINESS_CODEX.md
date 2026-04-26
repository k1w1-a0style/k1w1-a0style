# RELEASE READINESS BEFUND (Codex)

Stand: **2026-04-26**  
Scope: Finale Qualitaetsrunde (kleine gezielte Doku-/SoT-Syncs, keine grossen Refactors, keine Secrets).

## 1) Zentrale Wahrheit (aktueller Gate)

- Zentraler Sammelcheck bleibt: `npm run release:ready`.
- Ampel-Semantik:
  - `🟢 GRUEN`: alle Pflichtchecks bestanden.
  - `🟡 GELB`: Pflichtchecks bestanden, optionale Live-Checks wurden mangels ENV geskippt.
  - `🔴 ROT`: mindestens ein Pflichtcheck fehlgeschlagen.
- Live-Checks laufen nur mit gesetzter ENV (`EDGE_BASE_URL`, `EDGE_OPERATOR_JWT`), ohne Secret-Value-Logging.

## 2) Erledigt / gehaertet (bleibt als geschlossen dokumentiert)

- Preview-Haertung: abgeschlossen; produktionsseitig kein implizit aktiver esm.sh-Default.
- Android-Backup-Haertung: abgeschlossen (`android:allowBackup="false"` + Backup/Data-Extraction-Regeln).
- CI/CD-Writeback-Haertung: abgeschlossen (Least-Privilege; Root `contents: read`, Writeback nur job-spezifisch).
- Release-Gate-Zentralisierung: abgeschlossen (`release:ready` als zentraler Einstieg).

## 3) Einziger bewusst offener Punkt

- Vollstaendiger Live-Sign-off ist weiterhin env-/operator-gebunden und bleibt ausserhalb lokaler Default-Laeufe offen:
  - benoetigt `EDGE_BASE_URL`
  - benoetigt `EDGE_OPERATOR_JWT`
  - Ziel fuer Vollbeleg: `release:ready` mit Live-ENV ohne SKIP.

## 4) Drift-Check (dieser Durchlauf)

Aktive Doku-/SoT-Aussagen wurden gegen offensichtliche Widersprueche geprueft:

- Kein aktiver SoT-Widerspruch zu `android:allowBackup="true"` gefunden (aktive Konfiguration steht auf `false`).
- Kein aktiver SoT-Widerspruch, dass `PREVIEW_ALLOW_ESM_SH_CDN` in Production per Default aktiv waere.
- Kein aktiver SoT-Widerspruch, dass `contents: write` workflow-global als harter Default gesetzt waere.
- Kein aktiver SoT-Widerspruch, dass Release-Readiness nur aus Einzelcommands bestünde statt `npm run release:ready`.

Historische Append-only Logs wurden nicht umgeschrieben.

## 5) Ergebnis

**Release-Readiness-SoT ist lokal konsistent und mergebar fuer den Doku-Scope.**

Offen bleibt ausschliesslich die externe Live-ENV-Verifikation in einer sicheren Operator-/CI-Umgebung.

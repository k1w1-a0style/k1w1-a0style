# TODO

Stand: **2026-04-24 (Patch 786, GradleWrapperShaAndroidTaskVerification)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

> Ehrliche Restpunkt-SoT: diese Datei fokussiert auf **offene** bzw. bewusst offene Punkte.
> Abgeschlossene Patch-Details bleiben in `PROJECT_CHECKLOG.md` und `docs/patches/PATCHLOG_ROOT.md` (append-only Historie).


## 0) Hinweis zur frueheren Aussage

Die fruehere Aussage "keine offenen Repo-Muss-Punkte" war in dieser Pauschalform nicht mehr haltbar und wurde deshalb korrigiert.

## 1) In diesem Durchlauf im Repo gefixt (nicht-live)

- Preview-Secret-Vertrag bleibt aktiv **hash-only** (kein Legacy-Raw-Fallback als aktive Wahrheit).
- Preview-Haertung ist als umgesetzt dokumentiert (u. a. strictere Defaults, produktionsseitig kein impliziter esm.sh-Default aktiv).
- Android-Backup-Haertung ist umgesetzt (`android:allowBackup="false"` + defensive Backup-Regeln).
- CI/CD-Writeback-Haertung ist umgesetzt (Least-Privilege; kein globales Writeback als Default).
- `npm run release:ready` ist als zentraler Sammelcheck eingefuehrt und bleibt der verbindliche Einstieg.

## 2) Aktueller Kurzstatus (Repo-seitig)

- Kein aktuell bekannter technischer High-Priority-Restpunkt im Repo-Stand von Patch 786.
- Pflicht-Gates laufen auf dokumentiertem Stand gruen; ohne Live-ENV ist `release:ready` erwartbar `GELB` (kein `ROT`).

## 3) Bewusst offene Produkt-/Betriebsentscheidungen

- `diagnostics_reports`: bleibt bewusst offene Produktentscheidung (A/B), kein Blindumbau.
  - Referenz: Decision-Note 2026-04-03 (`docs/reviews/diagnostics_reports_policy_decision_2026-04-03.md`)

## 4) Externe Betriebs-Restpunkte (bewusst ausserhalb Repo-Code)

- Supabase-/Operator-Runbook-Restpunkt geschlossen (historischer Marker; kein offener privilegierter Testzustand aus dem bereinigten Test-User).
- build_admin-Governance muss extern eindeutig gepflegt bleiben (Owner, Rotation, Freigabeprozess).
- Vollstaendiger Live-Sign-off bleibt env-gebunden: reale Zugriffe/Secrets (`EDGE_BASE_URL`, `EDGE_OPERATOR_JWT`) sind erforderlich und lokal nicht simulierbar.

## 5) Niedrige Prioritaet / optionale Hygiene

1. verify_jwt-Flag-Recheck pro Release (Betriebshygiene)
2. Workflow-Hygiene nur mit engem Scope (z. B. verbleibende `npm install`-Fallbacks reduzieren, falls risikofrei)
3. punktuelle Live-Querpruefung verbleibender Trigger-/Hook-Funktionen auf `search_path` (Follow-up-Migration: `20260403060926_search_path_followup.sql`)

## 6) Benoetigte externe Infos / Zugaenge

- Supabase-Dashboard-/Admin-Zugriff (oder benannte verantwortliche Person)
- Berechtigung fuer Edge-Deployments und produktive SQL-Migrationen
- Verfuegbare Ziel-Environment-Secrets fuer Live-Vertragschecks
- geklaerter Prozess fuer build_admin-Provisioning (Owner + Rotation)

## Verbindliche Begleitquellen

- `docs/reviews/Review.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`

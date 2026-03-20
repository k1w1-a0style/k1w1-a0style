# Patch 495 — LocalRemoteDiffSection Same-Context-Truthfulness für lokale Dateiänderungen härten

## Ziel

`LocalRemoteDiffSection` soll im **gleichen Repo-/Branch-Kontext** keine alte Diff-Wahrheit weitertragen, wenn sich die lokalen `projectFiles` fachlich geändert haben.

Insbesondere muss gelten:

- lokale Änderungen invalidieren alte Diff-Items auch ohne Repo-/Branch-Wechsel,
- Selection / Push-Auswahl bleibt nicht still auf alter Diff-Grundlage aktiv,
- Inline-/Modal-Preview und Preview-Cache behaupten keine alte Wahrheit über neue lokale Inhalte,
- die UI zeigt ehrlich, dass ein neuer Vergleich per Refresh nötig ist,
- ohne lokale Änderung bleibt derselbe Diff-Kontext stabil.

## Umsetzung

### 1) Kleiner lokaler Truthfulness-Fingerprint

`LocalRemoteDiffSection.tsx` berechnet jetzt einen kleinen lokalen Fingerprint aus:

- normalisiertem Dateipfad,
- Content-Länge,
- kleinem Content-Hash.

Dieser Fingerprint ist günstig genug für den lokalen UI-Kontext und erkennt fachliche Änderungen an den lokalen Dateien, ohne sofort einen neuen Remote-Vergleich zu erzwingen.

### 2) Geladene Diff-Wahrheit an lokalen Stand gebunden

Der Bereich merkt sich jetzt explizit, **auf welchem lokalen Fingerprint** der zuletzt erfolgreich geladene Vergleich basiert.

Sobald sich die lokalen Dateien im selben Repo-/Branch-Kontext ändern und der gespeicherte Fingerprint nicht mehr passt, wird die alte Vergleichswahrheit invalidiert.

### 3) Ehrliche Invalidierung statt stiller Alt-Wahrheit

Bei so einer Same-Context-Änderung resetet die Section gezielt:

- Diff-Items,
- Auswahl / Push-Selection,
- Inline-Expanded-State,
- offene Preview / Modal-State,
- Preview-Inhalte,
- Preview-Cache,
- laufende Diff-/Preview-Requests.

Die UI zeigt dann bewusst einen kurzen Hinweis:

- `Lokale Dateien wurden geändert. Vergleich neu laden.`

Damit bleibt der bestehende Refresh-Button der aktive Re-Load-Mechanismus, aber alte Diff- oder Preview-Daten wirken nicht mehr fälschlich aktuell.

### 4) Preview-Cache jetzt an echte Diff-Grundlage gebunden

Der Preview-Cache nutzt jetzt nicht mehr nur Repo/Branch + Pfad, sondern den vollständigen Truth-Key aus:

- Repo,
- Branch,
- lokalem Fingerprint,
- Dateipfad.

Dadurch kann ein gecachtes Inline-/Modal-Diff aus einem älteren lokalen Dateistand nicht mehr still für einen neu geänderten lokalen Stand wiederverwendet werden.

## Tests

Gezielte Jest-Tests decken jetzt zusätzlich ab:

1. lokale Dateiänderung im selben Repo-/Branch-Kontext invalidiert alte Diff-Items,
2. bestehende Push-Auswahl bleibt nach lokaler Änderung nicht still aktiv,
3. offene Preview und Preview-Cache werden nach lokaler Änderung geleert,
4. die UI signalisiert ehrlich, dass ein neuer Vergleich nötig ist,
5. ohne lokale Änderung bleibt derselbe Repo-/Branch-Diff stabil.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

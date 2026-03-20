# Patch 499 — Repo Secret vs. lokaler App-Wert im GitHubReposScreen

## Ziel

Der GitHubReposScreen soll fuer `EXPO_TOKEN` und `K1W1_EDGE_ADMIN_KEY` klar zwischen zwei Ebenen unterscheiden:

- **Repo Secret** im GitHub-Repo
- **Lokaler App-Wert** in SecureStore auf dem aktuellen Geraet

Bisher konnte ein gruener Repo-Secret-Status zu leicht wie „CI Lite / Dispatch bereit“ wirken, obwohl lokal noch der benoetigte Laufzeitwert fehlte.

## Umsetzung

### 1) Sichtbare Source-of-Truth-Trennung in `SecretsSection`

`screens/GitHubReposScreen/components/SecretsSection.tsx` laedt jetzt zusaetzlich die lokalen SecureStore-Werte fuer `EXPO_TOKEN` und `K1W1_EDGE_ADMIN_KEY`.

Fuer beide Schluessel rendert die UI nun getrennt:

- `Repo Secret`
- `Lokaler App-Wert`

Damit bleibt sichtbar, ob GitHub nur den Secret-Namen bestaetigt hat oder ob der Wert auf diesem Geraet fuer App-Laufzeit/Dispatch wirklich vorhanden ist.

### 2) Ehrliche Summary gegen false green

Eine zusaetzliche Summary-Box macht explizit klar:

- bestaetigter Repo-Secret-Name ist **nicht** automatisch lokale Dispatch-Bereitschaft
- fehlende lokale Werte werden direkt benannt
- bei vollstaendig vorhandenen lokalen Werten bleibt die Trennung trotzdem sichtbar

Das verhindert insbesondere die irrefuehrende Lesart, dass `K1W1_EDGE_ADMIN_KEY` im Repo allein schon CI Lite Auth bedeute.

### 3) Kleiner CI-Lite-Hinweis im Modal

`components/CiLiteHeaderButton/components/CiLiteModal.tsx` zeigt jetzt eine kurze Hinweisbox:

- CI Lite Dispatch nutzt den **lokalen** Edge Admin Key aus SecureStore
- der Repo Secret-Name `K1W1_EDGE_ADMIN_KEY` allein reicht dafuer nicht

Keine neue Auth-Architektur, keine Online-Validierung, nur ehrliche Copy zur bestehenden Source of Truth.

## Tests

Ergaenzte/angepasste Jest-Regressionen decken ab:

1. Repo-Secret vorhanden + lokaler Edge Admin Key fehlt
2. Repo-Secret vorhanden + lokaler Edge Admin Key vorhanden
3. Repo-Secret wirkt nicht mehr wie sichere CI-Lite-Bereitschaft ohne lokalen Key
4. `EXPO_TOKEN` trennt Repo-Secret und lokalen App-Wert sauber
5. bestehende Repo-Secret-Namensanzeige bleibt funktional

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

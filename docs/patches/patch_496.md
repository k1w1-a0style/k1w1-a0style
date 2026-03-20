# Patch 496 — GitHubReposScreen EAS-Link-Statuschecks gegen stale async / Race-Zustände härten

## Ziel

Der EAS-Link-Status im `GitHubReposScreen` soll immer nur zur **aktuell aktiven Repo-/Branch-Auswahl** gehören.

Insbesondere muss gelten:

- verspätete ältere Statuschecks dürfen keinen neueren Zustand mehr committen,
- Repo-/Branch-Wechsel zeigen lieber neutralen `unknown`-Status statt Altwahrheit,
- der Write→Recheck-Pfad bleibt vor älteren In-Flight-Checks geschützt,
- manuelle Checks und Rechecks verwenden dieselbe Guard-Wahrheit,
- normale Same-Context-Verifikation funktioniert unverändert weiter.

## Umsetzung

### 1) Kleiner Request-/Generation-Guard im RepoScreen

Ein neuer kleiner Helper `easLinkStatusRequestGuard` kapselt genau drei Dinge:

- aktiven Kontext-Key (`repo@@branch`),
- monotone Request-ID,
- die Frage, ob ein Ergebnis **noch aktuell committen darf**.

Der Hook benutzt diesen Guard lokal per `ref`, ohne breiteren Hook-/Architekturumbau.

### 2) Harte Kontextbindung für jeden EAS-Statuslauf

`handleEasLinkStatusCheck(...)` startet jetzt jeden Prüflauf mit einem Token aus:

- Request-ID
- Kontext-Key (`repo@@branch`)

Nach dem asynchronen Check wird Status nur noch geschrieben, wenn:

- der Request noch der neueste ist und
- der Kontext immer noch zum aktiven Repo/Branch passt.

Dadurch können alte `verified`-, `workflow_missing`-, `project_mismatch`- oder `auth_error`-Antworten nicht mehr in einen neueren Kontext zurückschreiben.

### 3) Neutraler Reset bei Repo-/Branch-Wechsel

Bei jedem Kontextwechsel invalidiert der Guard jetzt laufende Requests sofort und setzt die UI bewusst auf einen neutralen `unknown`-Status zurück.

Die Anzeige behauptet damit nicht mehr kurzzeitig einen alten verifizierten oder fehlerhaften Zustand für die neue Auswahl.

### 4) Write→Recheck teilt dieselbe Guard-Wahrheit

`handleEasLink(...)` startet vor dem Write jetzt ebenfalls einen neuen Guard-Token und markiert den Status zunächst als `pending_recheck`.

Danach gilt:

- ältere In-Flight-Checks sind sofort stale,
- der Recheck nach dem Write bekommt einen neueren Guard-Token,
- nur dieser aktuelle Recheck darf noch `verified` oder einen ehrlichen Fehlerstatus schreiben.

So entsteht kein false-green durch einen verspäteten Alt-Request.

## Tests

Gezielte Jest-Tests decken jetzt ab:

1. Kontextwechsel invalidiert alte Requests,
2. neuere Requests gewinnen gegen ältere langsamere Läufe,
3. Write→Recheck invalidiert ältere In-Flight-Checks,
4. Repo-/Branch-Wechsel resetet den Hook-/UI-Status neutral auf `unknown`,
5. Same-Context-Checks bleiben gültig und kommittierbar.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

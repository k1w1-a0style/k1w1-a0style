# Patch 659 — Refactor-Nachzug 19.1 (Import/Export helper polish + typing/docs sync)

## Ziel
Kleinen Nachzug zu Durchlauf 19 sauber abschliessen:
- Import-/Export-Abbrucherkennung robuster machen
- den aktuellen Typing-Reststand fuer die naechste Runde ehrlich nachziehen

## Umgesetzt
- `screens/AppInfoScreen/hooks/importExportErrorHelpers.ts`
  - Cancel-/Abort-Erkennung deckt jetzt neben `abgebrochen` auch `cancelled` / `canceled` ab
- `__tests__/importExportErrorHelpers.test.ts`
  - neue Faelle fuer englische Cancel-Meldungen
- `docs/04-risk-hotspots.md`
  - aktueller `as any` / `: any`-Stand fuer den naechsten Follow-up nachgezogen

## Nicht gemacht
- kein neuer Refactor-Durchlauf 20
- kein `jsonUtils`-Rueckgabe-/Caller-Umbau in diesem Nachzug
- kein Logger-/Keystore-typing-Block

## Einordnung
Kein Vertragsumbau. Nur kleiner Robustheits- und Truthfulness-Nachzug vor Durchlauf 20.

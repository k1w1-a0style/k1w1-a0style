# PATCH 45 – PreviewScreen: Flows/Retry + Restore-Guards

Datum: **2026-02-10**

## Ziel
PreviewScreen funktional robuster machen (Flows/Fehler/Retry), ohne UI-Polish/Großumbau.

## Änderungen
- **createPreview() → null** wird jetzt sauber als Fehlerfall behandelt (User sieht eine Warnung statt “nichts passiert”).
- **Reopen/Copy Guards**: wenn `lastPreview` zwar vorhanden ist, aber weder `url` noch `html` verfügbar ist (typisch nach App-Neustart bei `source="local"`), wird erklärt, dass eine neue Preview erstellt werden muss.
- **Retry-Button** direkt in der Error-Card.
- **Buttons disabled** während `isCreating` oder wenn keine nutzbare letzte Preview vorhanden ist.
- Kleiner Hinweistext: lokale Previews sind nach Neustart nicht wiederherstellbar.

## Betroffene Dateien
- `screens/PreviewScreen.tsx`
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`

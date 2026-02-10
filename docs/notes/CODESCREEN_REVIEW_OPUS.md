# CodeScreen Review (Opus cross-check)

Diese Notiz fasst die externen Review-Punkte zusammen und dokumentiert den aktuellen Status.

## Kritische Punkte aus der Review

### 1) Injection-Risiko beim Initialwert im WebView
**Problem:** Content wurde in HTML/JS eingebettet; unvollständiges Escaping könnte String-Kontexte brechen.

**Status:** ✅ Gefixt – Initialwert wird nicht mehr „unsafe“ in JS-Strings interpoliert; Initialisierung wurde gehärtet.

### 2) Focus-Tracking / Cursor-Sprünge
**Problem:** Focus/Blur Messages wurden nicht sauber verarbeitet, dadurch konnten externe Updates während Tippen reinfunken.

**Status:** ✅ Gefixt – Focus-State wird verarbeitet, Sync ist stabil.

### 3) `isDirty` Logik doppelt
**Problem:** Hook/ UI hatten unterschiedliche Berechnung.

**Status:** ✅ Gefixt – einheitliche `isDirty` Quelle.

## Offene (Nice-to-have) Punkte
- `useCodeScreen` ist groß → später splitten.
- Typings:
  - `gap` sauber global typisieren
  - expo-file-system Typen sauber ergänzen
- Performance: Syntax-Validation ggf. aus Main-Thread nehmen, falls bei großen Dateien ruckelt.

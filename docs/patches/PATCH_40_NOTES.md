# PATCH 40 – CodeScreen micro-refactor + docs sync

## Ziel
Kleine, risikoarme Cleanup-Runde, damit der CodeScreen sauber bleibt und die Doku den realen Stand widerspiegelt.

## Änderungen
- **CodeScreen:** `EXTENSIONLESS_ALLOWLIST` ("Dockerfile", "Makefile", "README", "LICENSE", "CHANGELOG") als Modul-Konstante definiert, damit es nicht pro Render/Callback neu erzeugt wird.
- **CodeScreen:** `handleCreateFile` verwendet einen getrimmten `baseName`, und die Extension-Logik basiert nun konsistent auf diesem Namen.
- **Docs:** `docs/TODO.md` und `docs/notes/NEW_CHAT_PROMPT.md` aktualisiert, damit Patch-Status und Next Steps stimmen.

## Risiko
Sehr niedrig (Refactor ohne Behavioral Change, plus reine Doku).

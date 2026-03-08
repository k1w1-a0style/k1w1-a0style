# Patch 402

## Ziel
`run_safe_patch.sh` als echte Repo-Datei ergänzen, damit Patch-ZIPs sicher angewendet werden können,
ohne dass temporäre Patch-Ordner in `typecheck`, `lint` oder `test` hineinlaufen.

## Enthaltene Datei
- `scripts/run_safe_patch.sh`
- `docs/patches/patch_402.md`

## Verhalten
Der Runner:
1. entpackt eine Patch-ZIP
2. löscht die ZIP sofort
3. führt das Apply-Script aus
4. entfernt den entpackten Patch-Ordner vor den Repo-Checks
5. startet `npm run typecheck`, `npm run lint:ci`, `npm run test:silent`
6. kann optional zusätzliche Check-Kommandos ausführen

## Beispiel
```bash
bash scripts/run_safe_patch.sh \
  k1w1-patch-401-context-guards-r1.zip \
  patch_401_context_guards_r1_package \
  apply_patch_401_context_guards_r1.sh
```

## Warum
Damit der Fehlerfall aus Patch 401 nicht nochmal passiert, bei dem `tsc` versehentlich Dateien im temporären Patch-Ordner mitprüft.

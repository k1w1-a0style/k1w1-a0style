# Arbeitsablauf: Patch-Zip → Checks → Commit

Dieser Ablauf ist die "Standard-Route" für jeden Patch.

## 1) Patch anwenden

```bash
rm -rf <PATCH_PACKAGE_DIR>
unzip -o <PATCH_ZIP> -d .
chmod +x <PATCH_PACKAGE_DIR>/apply_patch_<ID>.sh
./<PATCH_PACKAGE_DIR>/apply_patch_<ID>.sh
rm -rf <PATCH_PACKAGE_DIR>
rm -f <PATCH_ZIP>
```

Hinweise:
- Erst den alten **entpackten Patch-Ordner** löschen, nicht die ZIP-Datei.
- Die ZIP kann nach erfolgreichem Anwenden gelöscht werden; sie muss aber bis dahin erhalten bleiben.
- Wenn das Paket ein Guard-Script mitliefert, dieses vor `typecheck/lint/tests` zusätzlich ausführen.

## 2) Qualitäts-Checks (müssen grün sein)

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

## 3) Commit & Push

```bash
git add -A
git commit -m "<message>"
git push
git status
```

## Leitplanken

- Wenn **typecheck/lint/tests rot** sind: **nicht** committen. Erst fixen.
- Patch-Hilfsdateien (Diffs, Notes) **nicht** committen. Wenn du sie behalten willst: nach `docs/patches/` verschieben.
- Commit-Messages: klein, klar, thematisch (ein Patch = ein Thema).

## Nach jedem Patch
- `docs/TODO.md` aktualisieren (✅ done / 🔜 next).
- `PROJECT_CHECKLOG.md` kurz ergänzen.
- `docs/patches/PATCHLOG_ROOT.md` und die neue `docs/patches/patch_<ID>.md` synchron halten.

## Neuen Chat starten
Wenn der Chat zu groß wird: den Inhalt aus `docs/HANDOFF_NEXT_CHAT.md` in den ersten Prompt vom neuen Chat kopieren.

# Patch 230 — Bundle 227–229 (CI Lite SoT + DEV_COMMANDS)

**Ziel:** Alle Änderungen aus Patch 227, 228 und 229 als **ein** "Apply-ZIP" bündelbar machen, damit ein frischer Projekt-Stand ohne Patch-Kette reproduzierbar ist.

## Inhalt

### CI Lite: Source-of-Truth & Robustheit
- `CiLiteHeaderButton` nutzt zentrale Utilities (`components/ciLite/ciLiteUtils.ts`).
- `applyPatchFromText` Dependency-Härtung (Repo/Branch Wechsel sicher).

### Docs: DEV_COMMANDS (ohne `rg`)
- Neue `docs/DEV_COMMANDS.md` mit **grep/find** Alternativen (kein `rg` nötig).
- Patch-Apply Template angepasst ("nur tests" Workflow möglich, weil `pre-commit` typecheck/lint ohnehin erzwingt).

### Docs Alignment
- `docs/TODO.md`, `docs/INDEX.md`, `PATCHLOG_ROOT.md`, `README.md`, `PROJECT_CHECKLOG.md` auf Stand gebracht.

## Apply

```bash
# 1) ZIP entpacken
unzip -o k1w1-a0style_patch_230_ALL.zip -d .

# 2) ZIP löschen
rm -f k1w1-a0style_patch_230_ALL.zip

# 3) Checks (reicht)
npm run test:silent

# 4) Commit + Push
git add -A
git commit -m "Patch 230: bundle 227-229 (CI Lite SoT + DEV_COMMANDS + docs alignment)"
git push
```

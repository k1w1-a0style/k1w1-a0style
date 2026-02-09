# Arbeitsablauf: Patch-Zip → Checks → Commit

Dieser Ablauf ist die "Standard-Route" für jeden Patch.

## 1) Patch anwenden

```bash
unzip -o <PATCH_ZIP> -d .
rm -f <PATCH_ZIP>
```

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

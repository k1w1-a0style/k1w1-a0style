# PATCH 37 — CodeScreen cleanup + new-chat handoff

## Ziel
- Kleine, **UI-neutrale** CodeScreen-Aufräumarbeiten (Dead import, extensionless files, dep churn)
- Handoff-Doku für einen neuen Chat (Prompt + Workflow)
- TODO wird um Patch-37-Block ergänzt

## Anwenden
```bash
unzip -o k1w1-a0style_patch_37.zip -d .
rm -f k1w1-a0style_patch_37.zip
chmod +x scripts/maintenance/patch37_codescreen_cleanup.sh
./scripts/maintenance/patch37_codescreen_cleanup.sh

npm run typecheck
npm run lint:ci
npm run test:silent

git add -A
git commit -m "chore(codescreen): cleanup + handoff docs (patch 37)"
git push
```

## Notes
- Keine Splitscreen-Änderungen.
- Falls die Perl-Replacements nicht matchen, bleibt die Datei unverändert (safe).

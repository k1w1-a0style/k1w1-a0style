K1W1 A0STYLE - PATCH ZIP Anleitung

Jeder Patch kommt als ZIP: `k1w1-a0style_patch_<PATCHNUM>.zip`.

Anwenden:
1) ZIP in den Projekt-Root legen
2) Entpacken + ZIP löschen:

  unzip -o k1w1-a0style_patch_<PATCHNUM>.zip -d .
  rm -f k1w1-a0style_patch_<PATCHNUM>.zip

3) Danach (Pflicht):
  npm run typecheck
  npm run lint:ci
  npm run test:silent

Wenn alles grün ist:
  git add -A
  git commit -m "Patch <PATCHNUM>: <kurzer Titel>"
  git push origin main


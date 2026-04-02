# Patch 673 — Refactor-Durchlauf 33 (tooling script cleanup)

## Ziel
Den letzten verbliebenen Non-Test-`any`-Rest ausserhalb von Docs/Historie entfernen, ohne den Android-Keystore-Forge-Patchzweck oder die Idempotenz des Scripts zu aendern.

## Umsetzung
- `scripts/patch_edge_forge_getbytes_v20.sh` nutzt fuer den `forge.random.getBytes`-Patch jetzt einen getypten Callback-Vertrag statt `cb?: any`.
- Das Script erkennt sowohl den alten Legacy-Block als auch einen bereits modernisierten Zielblock und bleibt dadurch idempotent.
- Der eigentliche Android-Keystore-Forge-Patchzweck bleibt unveraendert.

## Verifikation
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Doku
- README / TODO / Risk-Hotspots / Checklog / Patchlog auf Patch 673 synchronisiert.

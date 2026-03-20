# Patch 494 — LocalRemoteDiffSection stale async / Diff-Truthfulness härten

## Ziel

Der Diff-Bereich im GitHubReposScreen soll beim Repo-/Branch-Wechsel keine alte Wahrheit mehr weiterzeigen.

Insbesondere muss gelten:

- laufende Diff-Loads aus dem alten Kontext dürfen nicht mehr committen,
- Preview-/Diff-Cache darf keine alte Repo-/Branch-Wahrheit in den neuen Kontext tragen,
- Selection, Inline-Expanded-State und Modal-/Inline-Preview resetten ehrlich auf neutral,
- normaler Diff-Load im selben Kontext bleibt unverändert funktionsfähig.

## Umsetzung

### 1) Laufende Requests hart invalidiert

`LocalRemoteDiffSection.tsx` nutzt jetzt eine explizitere Invalidierung für beide asynchronen Pfade:

- Diff-Liste (`load`)
- Preview-/Detail-Ladevorgänge (`openPreview`)

Repo-/Branch-Wechsel erhöhen die bestehenden Guard-Referenzen aktiv, sodass verspätete Rückläufer aus dem alten Kontext keine alten Items, Notes oder Preview-Inhalte mehr committen können.

### 2) Kontextwechsel ehrlich neutralisiert

Beim Wechsel des aktiven Repo-/Branch-Kontexts resetet die Section jetzt gezielt:

- `items`
- `note`
- `selected`
- Inline-Expanded-State
- Inline-Loading-State
- Modal-Preview-State
- Preview-Inhalte (`path`, `local`, `remote`, `diff`)
- Preview-Cache

Dadurch zeigt der Bereich im frischen Kontext lieber leer/neutral statt kurz alte Datei- oder Diff-Wahrheit.

### 3) Preview-Cache an Kontext gebunden

Der Preview-Cache ist nicht mehr nur nach Dateipfad adressiert, sondern nutzt einen expliziten Kontext-Key aus aktivem Repo + Branch.

Folge:

- gleicher Dateipfad in anderem Repo nutzt keinen alten Cache-Treffer,
- Inline-Preview und Modal-Preview ziehen nach einem Kontextwechsel nur noch zum aktuellen Repo-/Branch-Kontext passende Inhalte.

### 4) Preview-/Modal-Wahrheit gegen späte Rückläufer abgesichert

`openPreview(...)` committet Preview-State nur noch, wenn Request-ID und Kontext-Key noch zum aktiven Zustand passen.

Damit können verspätete Remote-Reads aus einem alten Repo-/Branch-Kontext weder

- das Modal wieder mit alter Datei füllen,
- noch Inline-Diffs aus dem alten Kontext nachträglich einblenden.

## Tests

Neue Jest-Tests decken gezielt ab:

1. stale Diff-Load aus altem Repo/Branch committet nach Kontextwechsel nicht mehr,
2. Preview-Cache wird bei Repo-Wechsel nicht blind wiederverwendet,
3. Selection / Inline-Expanded-State / Modal-Preview resetten beim Kontextwechsel sauber,
4. verspätete Preview-Rückläufer zeigen nach Wechsel keine alte Datei-/Diff-Wahrheit mehr,
5. normaler Diff-Flow im selben Repo-/Branch-Kontext funktioniert weiter.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

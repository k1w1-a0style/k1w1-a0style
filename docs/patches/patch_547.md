# Patch 547

## Ziel

Den wieder roten Default-Jest-Lauf minimal stabilisieren und gleichzeitig den verpflichtenden Patch-/Checklog-/README-Sync fuer den bereits gelandeten Modellkatalog- und Settings-Metadaten-Stand nachziehen.

## Ausgangslage / Root Cause

- Im Default-Lauf von `npm run test:silent` lief `__tests__/localRemoteDiffSection.truthfulness.test.tsx` erneut in einen 20s-Timeout.
- Root Cause war nicht Produktcode-Drift in `LocalRemoteDiffSection.tsx`, sondern ein zu schwacher Test-Wait-Helper:
  - `waitForContextReset(...)` wartete nur auf `Push (0)`.
  - Dieser Text ist im leeren Ausgangszustand bereits oft sichtbar und beweist daher keinen echten Repo-/Branch-Reset.
  - Unter Last konnte der Test dadurch den zweiten Refresh fuer `repo-b/develop` zu frueh ausloesen, waehrend der erste `repo-a`-Load noch als `loading` lief.
- Zusaetzlich war der bereits gelandete Commit `Update model catalog and defaults; add model metadata and show meta pills in settings UI` noch nicht in den verpflichtenden Patch-/Checklog-Dokumenten vermerkt.

## Umgesetzte Aenderungen

- `__tests__/localRemoteDiffSection.truthfulness.test.tsx`
  - `waitForContextReset(...)` wartet jetzt auf:
    - den erwarteten Repo-/Branch-/Datei-Labeltext des neuen Kontexts und
    - einen nicht mehr deaktivierten Refresh-Button.
  - Die beiden Context-Switch-Faelle nutzen diesen staerkeren Wait-Helper jetzt explizit fuer `owner/repo-b`.
- `README.md`
  - neuen Top-Level-Status fuer Patch 547 ergänzt.
  - Abschlussmarker auf `Zuletzt abgeschlossen: **Patch 547**` angehoben.
- `docs/patches/PATCHLOG_ROOT.md`
  - neuen Patch-547-Eintrag fuer Flake-Fix plus Doku-Sync ergänzt.
- `PROJECT_CHECKLOG.md`
  - neuen Checklog-Eintrag mit Root Cause, Fix und Validierung ergänzt.
- `docs/patches/patch_547.md`
  - diese Patch-Notiz als kanonische Beschreibung des Fixes angelegt.

## Zusaetzlich nachdokumentierter Produktstand (bereits im vorherigen Commit umgesetzt)

- `contexts/AIContext/models.ts`
  - neuere Default-Modelle und erweiterte Modell-Metadaten (`pricePerMillion`, `availabilityLabel`, `codingStrength`).
- `supabase/functions/k1w1-handler/helpers.ts`
  - Handler-Defaults auf denselben Modellstand gezogen.
- `screens/SettingsScreen/components/ModeList.tsx`
  - Meta-Pills fuer Preis, Kontextfenster, Verfuegbarkeit und Coding-Staerke sichtbar gemacht.

## Validierung

- `npm run test:silent -- --runInBand __tests__/localRemoteDiffSection.truthfulness.test.tsx`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
- `git diff --check`

# Patch 695 — Template-Literal-Nachzug fuer syntaxValidator

## Ziel

Den im Nachscan auf Patch 694 identifizierten Rest in `utils/syntaxValidator.ts` minimal schliessen: Delimiter innerhalb von Template-Literal-Ausdruecken `${...}` sollen als echter Codepfad geprueft werden, statt pauschal mit dem Template-Text ignoriert zu werden.

## Umgesetzt

- `utils/syntaxValidator.ts`
  - der Delimiter-Scanner verwaltet Template-Literal-Text und `${...}`-Ausdruckstiefen jetzt getrennt,
  - Klammern innerhalb von `${...}` werden dadurch wieder als echter Code gezaehlt,
  - Strings, Kommentare und Regex-Literale bleiben weiterhin ausgenommen.
- `__tests__/syntaxValidator.test.ts`
  - neue Regression fuer den Fall `export const Demo = () => `${foo(}`;`.

## Kritischer Befund

Patch 694 hat die groben False Positives fuer Regex/String/Kommentar bereits geschlossen, liess aber noch einen kleinen False-Negative-Rest in Template-Literal-Ausdruecken offen. Patch 695 schliesst genau diesen Rest ohne AST-Umbau oder sonstige Semantikverschiebung.

## Validation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

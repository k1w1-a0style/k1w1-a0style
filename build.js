/**
 * build.js
 *
 * Deprecated / intentionally disabled.
 *
 * Hintergrund: Dieses Repo emittiert kein `dist/` (tsc --noEmit), daher war die frühere
 * `require("./dist/...")`-Variante nicht lauffähig und hat in Reviews für Verwirrung gesorgt.
 *
 * Wenn du ein echtes Build-Script brauchst, füge einen Compile-Step hinzu (tsc emit nach dist/)
 * und ersetze dieses Stub-Script.
 */

// eslint-disable-next-line no-console
console.error('[build.js] Dieses Script ist deaktiviert. Siehe Kommentar im File.');
process.exitCode = 1;

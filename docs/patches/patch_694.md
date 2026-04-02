# Patch 694 — Kritischer Pass-53-Nachzug (syntaxValidator + auth timeout hardening)

## Ziel

Den Pass-53-ZIP-Stand gegen die belastbaren Deep-Scan-Funde kritisch pruefen und nur die nachweisbaren Reste schliessen:

1. `utils/syntaxValidator.ts` erzeugt False Positives bei Klammerzahlen in Strings/Regex/Kommentaren und prueft ungenutzte Imports zu grob auf dem rohen Volltext.
2. `supabase/functions/_shared/auth.ts` laesst drei serverseitige Supabase-`fetch()`-Pfade ohne expliziten Timeout laufen und bereinigt lokale `rateLimit(...)`-Keys nie aktiv.

## Umgesetzt

- `utils/syntaxValidator.ts`
  - neuer kleiner Delimiter-Scanner zaehlt `()[]{}` nur noch **ausserhalb** von Strings, Regex-Literalen und Kommentaren,
  - Import-Nutzung wird jetzt auf `codeWithoutImports` geprueft statt auf dem Gesamttext,
  - bestehende Warn-/Error-Semantik bleibt sonst unveraendert.
- `__tests__/syntaxValidator.test.ts`
  - Regression fuer Regex/String/Kommentar-False-Positive,
  - echter Unmatched-Delimiter-Fall,
  - echter/unechter Unused-Import-Fall.
- `supabase/functions/_shared/auth.ts`
  - gemeinsamer `fetchWithEdgeTimeout(...)`-Wrapper mit 8s `AbortController` fuer:
    - `verifyJwtViaSupabaseAuth(...)`
    - Durable-Rate-Limit-Insert
    - Durable-Rate-Limit-Count
  - `rateLimit(...)` fuehrt bei >5k Keys ein konservatives Cleanup fuer klar veraltete Eintraege aus.
- `__tests__/auth.failClosedAndDurableRateLimit.test.ts`
  - prueft jetzt zusaetzlich, dass die serverseitigen `fetch()`-Aufrufe einen `AbortSignal`-Pfad erhalten.

## Kritischer Befund

Der Scan-Fund zu den rohen Regex-Klammerzahlen in `syntaxValidator.ts` war belastbar und fuehrte im Editor zu echten False Positives. Der Import-Check war als Heuristik zusaetzlich zu grob, weil die Importzeile selbst in den Nutzungszaehler einging.\
Die drei serverseitigen `fetch()`-Pfade in `_shared/auth.ts` waren kein akuter Produktbruch, aber eine sinnvolle Haertung gegen lange Edge-Wartezeiten und lokalen Map-Wuchs.

## Validation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

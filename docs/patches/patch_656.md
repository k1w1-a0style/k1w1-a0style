# Patch 656 - Refactor Durchlauf 17 (Diagnostic display helper-first)

## Ziel
- Den in `docs/TODO.md` geplanten naechsten kleinen helper-first Refactor im Diagnostic-Hotspot sauber abschliessen.
- Issue-/Single-/Batch-Fix-Anzeige-Formatter aus `useDiagnosticFixRunner.ts` in einen reinen Helper ziehen.
- Zusaetzlich einen kleinen opportunistischen Typing-Nachzug in produktionsnahen Hilfsdateien mitnehmen, ohne Scope-Explosion.

## Umgesetzt
- Neuer Helper `screens/DiagnosticScreen/hooks/fixRunnerDisplayHelpers.ts` mit:
  - `formatBatchFixSubtitle(...)`
  - `formatIssueFixResultDetail(...)`
  - `formatSingleFixResultDetail(...)`
  - `formatBatchFixResultDetail(...)`
- `useDiagnosticFixRunner.ts` nutzt die neuen Anzeige-Helper statt lokaler Inline-Strings/Ternaere.
- Neuer fokussierter Test `__tests__/fixRunnerDisplayHelpers.test.ts`.
- Opportunitaetsblock:
  - `infra/github/tokenStore.ts`: `catch (error: any)` -> `catch (error: unknown)` plus kleiner sicherer Error-Message-Helper
  - `lib/diagnostics/templates/jsonUtils.ts`: Eingabeparameter von `any` auf `unknown` gezogen, Rueckgabe-/Caller-Vertrag bewusst unveraendert gehalten

## Nicht gemacht
- Kein Umbau der Runner-Orchestrierung
- Kein breiter `: any`-Sweep in Infra-/App-Hotspots
- Kein weiterer Hook-Split

## Verifikation
Hinweis: Im bereitgestellten ZIP fehlen installierte Abhaengigkeiten (`node_modules`), daher konnten `npm run typecheck`, `npm run lint:ci` und `npm run test:silent` in dieser Umgebung nicht belastbar ausgefuehrt werden.

Lokal erfolgreich pruefbar bzw. in dieser Umgebung ausgefuehrt:
```bash
bash scripts/check_patch_docs_sync.sh
node scripts/docsLint.js
```

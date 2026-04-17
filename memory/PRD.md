# PRD

## Original Problem Statement
Mach einen deep scan und prüfe alles kritisch.

## User Choices
- Prüfziel: Gesamtzustand des Projekts (Frontend, Backend, Struktur, Risiken)
- Ergebnisform: Analyse plus Prioritätenliste, danach auf Freigabe warten
- Testtiefe: Ja, UI/API bzw. verfügbare Prüfpfade aktiv testen
- Änderungsgrenze: Keine Änderungen am Produktcode, nur reporten

## Architekturentscheidungen / Ist-Zustand
- Repository ist kein Standard-Webstack, sondern eine Expo/React-Native-App mit TypeScript
- Kernbereiche: Screens, Hooks, Kontexte, GitHub-Integrationen, Supabase Edge Functions, lokale Persistenz, Preview-/Build-/Diagnostics-Flows
- Release-Verifikation basiert stark auf repo-internen Gates (`typecheck`, `lint`, `test`, `docs`, `verify:release`)
- Live-Supabase-Zustand konnte nicht unabhängig geprüft werden, da für MCP-Supabase-Tools kein gültiger Zugriffstoken verfügbar war

## Was in diesem Durchlauf umgesetzt wurde
- High-level Repo-Scan von Struktur, README, package.json, Kern-Doku und Einstiegspunkten
- Aktive Verifikation ausgeführt: `npm ci`, `npm run typecheck`, `npm run lint:ci`, `npm run typecheck:edge`, `npm run docs:lint`, `npm run docs:check:contracts`, `npm run test:silent`, `npm run verify:release`
- Zusätzliche Risiko-Scans: Pattern-Scan (`@ts-ignore`, `any`, silent catches, console.log), Größen-/Hotspot-Scan großer Dateien, produktiver `npm audit --omit=dev`
- Sicherheits-/Runtime-Lesung gezielter Dateien: `polyfills.ts`, `lib/supabase.ts`, `lib/supabaseEdge.ts`, `lib/supabaseRuntimeConfig.ts`, `lib/sandpackBuilder.ts`, `hooks/usePreviewCreation.ts`, `supabase/config.toml`, `infra/github/files/gitDataApi.ts`, `screens/ConnectionsScreen/hooks/useConnectionsSaveActions.ts`
- Keine Produktcode-Änderungen vorgenommen

## Priorisierter Backlog

### P0
- Live-Supabase-/Infra-Verifikation unabhängig nachholen (Edge Functions, Advisors, Tabellen, tatsächliche Deploy-Konfiguration), sobald gültiger Zugriff verfügbar ist
- Prüfen, ob Repo-Status `OK_WITH_SKIPS` in Zielumgebung wirklich zu `OK_FULL` hochgezogen werden kann

### P1
- Local-Preview-Fallback mit `unsafe-eval` + externen CDNs weiter minimieren oder stärker isolieren (`lib/sandpackBuilder.ts`, `hooks/usePreviewCreation.ts`)
- Fehlerbehandlung in `lib/supabaseEdge.ts` härten: AsyncStorage-Lesefehler nicht still auf `null` degradieren
- Kritische Hotspots mit hoher Änderungs-/Regressionsfläche gezielt entschärfen: `infra/github/files/gitDataApi.ts`, `useConnectionsSaveActions.ts`, `usePreviewScreen.ts`, `WebCodeEditor.tsx`

### P2
- Observability prüfen: globales Stummschalten von `console.log/info/debug` in Produktion bewerten (`polyfills.ts`)
- Deprecated Tooling aufräumen (`@testing-library/jest-native`, Husky-Install-Hinweis, transitive Deprecation-Warnungen)
- Große Style-/Screen-Dateien weiter modularisieren, wo echter Review-/Wartungsgewinn entsteht

## Nächste sinnvolle Tasks
1. P1-Fixes ohne großen Umbau umsetzen
2. Danach erneut gezielte Regressionstests laufen lassen
3. Anschließend Live-/Supabase-Validierung mit echtem Zugriff ergänzen

# Patch 608 - Finaler Cleanup der Config-SoT fuer `android-keystore-export`

## Kontext / Audit

Nach Patch 599 war die Config-SoT bereits fuer `android-keystore-generate` und `android-keystore-status` eindeutig auf `supabase/config.toml` gezogen.
Fuer `android-keystore-export` existierten jedoch weiterhin zwei Quellen:

- `supabase/config.toml`
- `supabase/functions/android-keystore-export/config.toml`

Beide standen aktuell auf `verify_jwt = true` (also kein akuter Produktionsbug), aber genau diese Doppelquelle blieb ein potentieller Drift-/Split-Brain-Punkt.

## Umsetzung

1. Redundante Export-Local-Config entfernt:
   - `supabase/functions/android-keystore-export/config.toml` geloescht.

2. Contract-/Invariant-Checks auf den eindeutigen Endzustand gezogen:
   - `scripts/check_workflow_edge_contracts.sh` erwartet fuer `android-keystore-export` jetzt **keine** funktionslokale Config mehr.
   - `__tests__/patch599.keystoreConfigSot.invariants.test.ts` prueft jetzt alle drei Keystore-Routen (`export`, `generate`, `status`) als Root-SoT mit `verify_jwt=true` und ohne lokale Config-Dateien.
   - `__tests__/patch549.keystoreExportJwtRbac.invariants.test.ts` wurde von lokaler Export-Config-Lesung auf Root-Config-Assertion + No-Local-Config-Guard umgestellt.

3. Doku-/Patchsync aktualisiert:
   - README, PROJECT_CHECKLOG, PATCHLOG_ROOT, EDGE_FUNCTIONS_STATUS, Build-Readiness, Risk-Hotspots.

## Ergebnis

`android-keystore-export` hat jetzt denselben eindeutigen fail-closed Config-Vertrag wie die anderen gehaerteten Keystore-Routen:

- einzige Config-SoT: `supabase/config.toml`
- `verify_jwt=true` bleibt verpflichtend
- keine lokale Schatten-Config mehr, die zukuenftig driften koennte

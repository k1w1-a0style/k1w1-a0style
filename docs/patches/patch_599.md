# Patch 599: Keystore verify_jwt Config-Split-Brain fail-closed bereinigt

## Ausgangslage

Es gab einen widerspruechlichen JWT-Vertrag fuer die Keystore-Routen:

- `supabase/config.toml` setzte fuer
  - `functions.android-keystore-status`
  - `functions.android-keystore-generate`
  jeweils `verify_jwt = true`.
- Gleichzeitig existierten funktionslokale Config-Dateien mit `verify_jwt = false`:
  - `supabase/functions/android-keystore-status/config.toml`
  - `supabase/functions/android-keystore-generate/config.toml`

Das erzeugte einen echten Config-Split-Brain zwischen Root-SoT und lokalen Schatten-Configs.

## Umsetzung

1. **Eindeutige SoT festgelegt:**
   - Fuer `android-keystore-status` und `android-keystore-generate` gilt jetzt ausschliesslich `supabase/config.toml` als `verify_jwt`-SoT.
   - Der Zielzustand bleibt fail-closed mit `verify_jwt = true`.

2. **Widerspruechliche lokale Configs entfernt:**
   - `supabase/functions/android-keystore-status/config.toml` geloescht.
   - `supabase/functions/android-keystore-generate/config.toml` geloescht.

3. **Regressionsschutz erweitert:**
   - `scripts/check_workflow_edge_contracts.sh` prueft jetzt explizit:
     - Root-Config fuer generate/status/export auf `verify_jwt = true`.
     - lokale Keystore-Configs fuer generate/status duerfen nicht existieren.
   - Neuer Test `__tests__/patch599.keystoreConfigSot.invariants.test.ts` sichert denselben Vertrag auf Testebene.

## Ergebnis

- Kein Widerspruch mehr zwischen Root- und funktionslokaler Config fuer die betroffenen Keystore-Routen.
- JWT-Vertrag fuer `android-keystore-status` und `android-keystore-generate` ist eindeutig, fail-closed und dokumentiert.
- Checks/Invariants verhindern erneuten Split-Brain.

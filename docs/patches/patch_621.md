# Patch 621 - retryWithBackoff Timing-Flake robust geschlossen

## Kontext
Der verbliebene praktische Restpunkt war ein sporadischer Fail in `lib/__tests__/retryWithBackoff.test.ts` beim Exponential-Backoff-Test.

## Root-Cause
- **Kein Runtime-Bug** in `lib/retryWithBackoff.ts`: Backoff ist deterministisch (1000ms, 2000ms, 4000ms, ... capped).
- **Test-Flake** durch fragile Messmethode: Der Test nutzte Real-Timer und `Date.now()`-Differenzen mit enger Obergrenze `< 1500ms` fuer den ersten Retry-Delay.
- Unter langsamer/lastiger Umgebung kann Event-Loop-/Scheduler-Drift reale Wandzeit deutlich nach oben verschieben, obwohl der berechnete Delay korrekt bleibt.

## Aenderung
- `lib/__tests__/retryWithBackoff.test.ts`:
  - Exponential-Backoff-Test auf **Fake-Timer-basierte, deterministische Vertragspruefung** umgestellt.
  - Assertions pruefen jetzt den fachlichen Kern:
    - kein zweiter Versuch vor 1000ms
    - zweiter Versuch genau nach Erreichen von 1000ms
    - kein dritter Versuch vor weiteren 2000ms
    - dritter Versuch nach Erreichen von insgesamt 3000ms
  - Keine pauschale Timeout-Erhoehung, kein Lockern von Backoff/Jitter-Logik.

## Runtime-Vertrag
- `retryWithBackoff` Runtime-Code bleibt unveraendert.
- Keine Aenderung am produktiven Retry-/Backoff-Verhalten.

## Verifikation
- `npm run test:silent -- --runInBand lib/__tests__/retryWithBackoff.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

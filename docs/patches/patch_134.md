# Patch 134

Datum: **2026-02-14**

## Kontext
Patch 133 hatte in `useConnectionsScreen.ts` versehentlich **zweimal** `const effectiveRepo = useMemo(...)` deklariert.
Das führte zu:
- **TypeScript:** `TS2451 Cannot redeclare block-scoped variable 'effectiveRepo'`
- **Jest/Babel:** Parse-Failure („Identifier has already been declared“)

## Fix
- Entfernt die doppelte `effectiveRepo`-Deklaration.
- Lässt die ursprüngliche (frühe) `effectiveRepo`-Definition bestehen und nutzt diese überall.

## Betroffene Dateien
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`

## Verifikation
Lokal ausgeführt (CI-äquivalent):
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅

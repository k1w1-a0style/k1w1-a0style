# Patch 134

## Fix

- Remove duplicate `effectiveRepo` declaration in `useConnectionsScreen` that caused TypeScript error `TS2451` and Jest/Babel parse failure.

## Files

- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`

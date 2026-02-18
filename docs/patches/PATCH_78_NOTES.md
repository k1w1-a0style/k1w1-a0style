# Patch 78 — TerminalScreen + redaction hotfix

## Fixes
- **TerminalScreen LogRow**: importiert `useMemo` korrekt (TypeScript Fehler TS2304).
- **Secret redaction**: `Authorization: Bearer ...` wird jetzt als `Authorization: Bearer <redacted>` maskiert (Scheme bleibt sichtbar), ohne dass die generische Authorization-Redaction den `Bearer`-Teil wegfrisst.

## Files
- `screens/TerminalScreen/components/LogRow.tsx`
- `lib/secretRedaction.ts`

# Patch 102 Notes – ChatScreen Chat-Verlauf leer (Legacy Migration)

**Datum:** 2026-02-13  
**Scope:** ChatScreen + Storage/Context (nur Client)  
**Risk:** niedrig (reine Migration/Rendering-Toleranz)

## Problem
Nach den letzten Patches war der Chatverlauf bei einigen Projekten komplett leer.  
Ursache: sehr alte Speicherstände enthielten Chat-Einträge ohne `id`.  
Seit ProjectContext/ChatScreen strikt nach `msg.id` filtern bzw. `keyExtractor` darauf basiert, wurden diese Einträge verworfen.

## Fix
- `contexts/projectStorage.ts`
  - Migration/Repair: `ensureChatHistoryHasIds()` ergänzt fehlende `id`/`timestamp` beim Laden.
- `contexts/ProjectContext.tsx`
  - Toleranter Messages-Selector: lässt alte Einträge durch (id **oder** timestamp + content).
- `screens/ChatScreen/index.tsx`
  - `keyExtractor`: `id || timestamp || index` als Fallback.
- Tests
  - `__tests__/chatHistoryMigration.test.ts` (Legacy chatHistory + legacy messages -> ids werden ergänzt)

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent` (neuer Test: `chatHistoryMigration.test.ts`)

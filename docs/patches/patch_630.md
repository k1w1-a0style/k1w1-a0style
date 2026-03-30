# Patch 630 — `as any`-Abbau (Durchlauf 4, UI-/Interop-Glue)

## Ziel
Noch ein kleiner, risikoarmer Durchlauf fuer lokale UI-/Interop-Glue-Casts ohne Architekturumbau.

## Umgesetzt
1. `components/CustomHeader.tsx`
   - Parent-/Drawer-Navigation ohne `as any` (kleine lokale Nav-Types).

2. `components/CustomDrawer/index.tsx`
   - Profil-Read (`preferredBuildProfile`/`buildProfile`) ohne `projectData as any` via Record-Narrowing.

3. `components/FileItem.tsx` und `screens/DiagnosticScreen/components/FixRunModal.tsx`
   - Ionicons-Namen via kleine Guard-Helper statt `icon as any`.

4. `screens/GitHubReposScreen/components/DiffFilesSection.tsx`
   - Additions/Deletions-Finite-Checks ohne `as any` (`toFiniteNumber`).

5. `screens/CodeScreen/components/WebCodeEditor.tsx`
   - `postMessage`-Zugriff ohne `webRef.current as any`.

6. `screens/EnhancedBuildScreen/components/ChecklistSection.tsx`
   - `FIX_ORDER.indexOf(...)` ohne `id as any`.

7. `screens/GitHubReposScreen/hooks/templateFiles.ts`
   - Template-Require als `unknown` + `Array.isArray` statt `as any[]`.

## Inventar
- Codefokussierter Scan (ohne `docs/**` und `README.md`):
  - Vorher: 197
  - Nachher: 187
  - Netto: **-10 `as any`**

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts`
- `git diff --check`

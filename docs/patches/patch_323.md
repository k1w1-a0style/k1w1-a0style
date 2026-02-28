# Patch 323: AIContext `any`-Reduktion + TODO-Sync

## Ziel
Nächsten Punkt aus der Fix-/TODO-Liste abarbeiten: TypeScript-Hygiene im Bereich `contexts/AIContext` verbessern und unnötige `any`-Casts entfernen.

## Änderungen
- `contexts/AIContext/helpers.ts`
  - `resolveLegacyAutoMode`: typisierte Provider-Defaults ohne `as any`.
  - `loadSecureApiKeys`/`saveSecureApiKeys`: Provider-Zugriffe typisiert statt `as any`.
  - `loadConfig`: JSON-Parsing mit explizitem Übergangstyp für Legacy-Felder (`agentEnabled`, `selected*Mode`, `apiKeys`) und darauf basierende Typprüfungen.
- `contexts/AIContext/index.tsx`
  - Redacted-Persistenz ohne `as any` (voll typisierter `AIConfig`-Wert).
  - SecureStore-Persistenzaufruf ohne `as any`.
  - Unused Import bereinigt.
- `docs/PROJECT_TODO.md`
  - TypeScript-Hygiene-Punkt präzisiert: AIContext-Teil als erledigt, Rest (`lib/orchestrator.ts` / weitere `any`-Reduktion) bleibt offen.

## Validierung
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Alle drei Checks laufen grün.

# Patch 328: Weitere TS-Hygiene (TerminalContext + BuildStatus)

## Ziel
Weitere Punkte aus der offenen Fix-Liste abarbeiten, mit Fokus auf risikoarme `any`-Reduktion in zentralen Runtime-Pfaden.

## Änderungen

### 1) `hooks/useBuildStatus.ts`
- `catch (e: any)` auf `catch (e: unknown)` umgestellt.
- Neuen Helper `getErrorMessage(error, fallback)` ergänzt, um Fehlertexte typ-sicher zu extrahieren.
- Logging im Error-Pfad auf den typ-sicheren Fehlertext umgestellt.

### 2) `contexts/TerminalContext.tsx`
- `formatArgs` von `any[]` auf `unknown[]` umgestellt.
- Console-Override-Handler (`console.log/warn/error`) ebenfalls auf `unknown[]` typisiert.
- Verhalten unverändert: Args werden weiter normalisiert geloggt und an originale Console weitergereicht.

### 3) TODO/Checklog/Patchlog synchronisiert
- `docs/PROJECT_TODO.md`: Restpunkt zu `: any`-Annotationen fortgeschrieben (377 → 372).
- `PROJECT_CHECKLOG.md`: Patch-328 Eintrag ergänzt.
- `docs/patches/PATCHLOG_ROOT.md`: Patch-328 Eintrag ergänzt.

## Validierung

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

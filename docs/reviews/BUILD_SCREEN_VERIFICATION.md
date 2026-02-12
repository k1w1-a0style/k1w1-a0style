# EnhancedBuildScreen – Verification (Patch 85)

Stand: 2026-02-12

## 1) Review-Check: Was stimmt, was nicht?

### ✅ Zutreffend (im Code wirklich relevant)

- **BS-01 (P1) Reentrancy / Doppel-Tap kann Build doppelt starten**
  - Vor Patch: `onStartBuild` ohne synchronen Guard → bei schnellem Doppeltap möglich.
  - Fix: `buildInFlightRef` blockt Duplikate sofort.

- **BS-02 (P1) Async-State-Updates ohne Unmount-Guard**
  - Vor Patch: `setState`/`Alert` nach `await` konnte nach Unmount feuern.
  - Fix: `isMountedRef` Guards in `fetchRuns`, `onRefresh`, `onStartBuild`, `onSaveLinkedRepo`, `onSaveRepoBranch`.

### ⚠️ Hardening / UX (sinnvoll, nicht zwingend P1)

- **BS-03 (P2) ETA “eingefroren”**
  - Fix: 1s-Tick während Build läuft → ETA aktualisiert live.

- **BS-04 (P2) Repo-Validierung zu schwach**
  - Fix: strikt `owner/repo` (genau ein `/`) + erlaubte Zeichen (`A-Z a-z 0-9 . _ -`).

- **BS-05 (P2) Run-Link ohne Guard**
  - Fix: Run-Link nutzt jetzt die vorhandene `openRun()` Guard-Funktion (canOpenURL + Fehler-Alert).

- **BS-08 (P2) Logs raw ohne Redaction (UI/Copy)**
  - Fix: `useGitHubActionsLogs` redacted + capped jede Zeile (`redactSecrets` + `truncateWithMarker`).
  - Zusätzlich: `BuildLogsModal` sanitized Copy/Fehlertexte als “defense in depth”.

## 2) Ändert das die Screen-Optik?

**Minimal / nur indirekt:**

- **ETA zählt jetzt sichtbar weiter** (live-Update während Build läuft).
- **Logs können anders aussehen**, wenn Tokens/Secrets drin waren: sie erscheinen als `<redacted>` / `<redacted-jwt>` und sehr lange Zeilen bekommen `…<truncated>`.

Layout/Spacing/Buttons bleiben gleich.

## 3) Patch 85 – Was wurde geändert?

- `useEnhancedBuildScreen.ts`
  - Reentrancy-Guard für Start Build
  - Unmount-Guards für async flows
  - Live ETA Tick
  - Striktere Repo-Validierung + sanitizierte Alert-Texte

- `useGitHubActionsLogs.ts`
  - Log-Redaction + per-line cap bevor Logs in UI/Clipboard landen

- `LogsAnalysisSection.tsx`
  - Run-Link via `openRun()` statt direktem `Linking.openURL`

- `BuildLogsModal.tsx`
  - Defense-in-depth: Copy/Fehlertexte nochmal redacted + Clipboard-Limit

## 4) Manuelle Smoke-Checks

1. Build Button schnell doppelt tippen → **nur ein** Build startet.
2. Build starten → ETA sollte im Sekundentakt “leben”.
3. Logs öffnen + “Copy Logs” → Clipboard enthält keine Tokens (Bearer/JWT/apiKey) und ist nicht unendlich groß.
4. Run-Link → öffnet nur wenn `canOpenURL` true (sonst sauberer Fehler).

---

## Patch 86 Hotfix
- Removed `status === "running"` check (unified `BuildStatus` type does not include `running`).
- No UI/behavior change besides fixing typecheck.

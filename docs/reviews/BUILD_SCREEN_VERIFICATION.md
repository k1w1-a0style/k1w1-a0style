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

## Patch 107 — GitHub Actions ref Verhalten
- Manuelle Workflow-Ausführung ohne `ref` nutzt jetzt den aktuellen Branch (`github.ref_name`).
- Wenn `ref` explizit gesetzt ist, wird genau dieser Ref gebaut.
- Concurrency-Group nutzt denselben Ref-Fallback (kein Cross-Branch Cancel durch default "main").

### Schnelltest
1. Workflow manuell starten, `ref` leer lassen → Logs zeigen Checkout von `github.ref_name`.
2. Workflow manuell starten, `ref` = `main` → Checkout `main`.


## Patch 109 — GitHub Actions Logs Diagnose
- `useGitHubActionsLogs` zeigt jetzt status-genaue Fehler (401/403/404/429/5xx) inkl. Hint (fehlender Admin Key, Function nicht deployed, RateLimit, fehlende Secrets).
- Edge Function `github-workflow-logs` nutzt jetzt `requireAdminKey` korrekt (Response wird returned) und korrektes `rateLimit` Bucket/Window.

### Schnelltest
1. Ohne Admin-Key: Logs abrufen → Fehlermeldung enthält 401 + Hinweis auf K1W1_EDGE_ADMIN_KEY.
2. Mit falscher Supabase URL / Function nicht deployed: 404 Hinweis.
3. Mit gültigem Key: Logs abrufbar.

---

## Patch 110 – GitHub Actions Logs 404 / "not ready"

### Beobachtung
- GitHub liefert bei `GET /actions/runs/{run_id}/logs` gelegentlich **404**, wenn der Run noch läuft oder der Logs-Zip noch nicht erstellt ist.
- Zusätzlich kann 404 auch "kein Zugriff" oder "falsche ID" bedeuten (Run-Number statt Run-ID).

### Fix-Check
- Edge-Function behandelt 404 jetzt als **soft state**:
  - Wenn Run existiert und `status != completed` ⇒ `status: "not_ready"` + Retry-After.
  - Wenn Run completed aber Zip noch nicht verfügbar ⇒ ebenfalls soft + Retry.
- App zeigt das als **Info** (kein roter Error) und lässt Auto-Refresh weiterlaufen.


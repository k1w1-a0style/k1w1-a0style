# Patch 178: Sidebar/Header Theme-Align + CI Lite GitHub Logs Fix

## Was war kaputt / unsauber?
- **Drawer/Sidebar:** Neon-Ränder wirkten zu dick/zu aggressiv und farblich nicht ganz passend zum restlichen UI (Chat/Buttons).
- **Header (oben):** Wirkte zu "schwarz" und dadurch optisch wie ein Fremdkörper.
- **CI Lite (Header-Test / Logs):** `github-workflow-runs` kam mit `502` + `GitHub API Status: 404` zurück.
  - Häufige Ursache: Edge Function nutzt serverseitiges GitHub Token ohne Zugriff auf private Repos **oder** Workflow-ID-Endpoint ist zu strikt.

## Änderungen
### UI
- Drawer/Sidebar:
  - Umgestellt auf **Hairline**-Borders (`StyleSheet.hairlineWidth`) statt optisch „dicker“ Linien.
  - Entfernt/abgeschwächt: harte Neon-Glows im Drawer (wirkt sonst wie ein fetter Rand).
  - Alle grünen Highlights/Overlays konsistent über `theme.palette.primary` / `theme.palette.userBubble.background`.
- Header:
  - Hintergrund von `backgroundDark` → `card` (passt zum restlichen UI/Chat).
  - Button-Rahmen ebenfalls hairline, Button-Flächen etwas „cardiger“ (weniger „schwarz Loch“).

### CI Lite / GitHub Logs
- App (`useGitHubActionsLogs`):
  - Sendet optional das **clientseitig gespeicherte GitHub PAT** (`githubToken`) an die Edge Functions (nur wenn Admin Key ok ist).
- Edge Function `github-workflow-runs`:
  - `workflowId` ist jetzt **optional**.
  - Wenn `workflowId` gesetzt ist, aber GitHub 404 liefert, gibt es **Fallback** auf repo-weite Runs (`/actions/runs`).
  - Akzeptiert `githubToken` (Body), falls vorhanden → wichtig für private Repos.
- Edge Function `github-workflow-logs`:
  - Akzeptiert `githubToken` (Body) und nutzt es beim Abruf der Logs ZIP (private Repos).

## Betroffene Dateien
- `components/CustomDrawer.tsx`
- `components/CustomHeader.tsx`
- `hooks/useGitHubActionsLogs.ts`
- `supabase/functions/github-workflow-runs/index.ts`
- `supabase/functions/github-workflow-logs/index.ts`

## Verifikation (kurz)
1. App starten, Drawer öffnen:
   - Linien sind feiner, Grün wirkt wie im Chat/Buttons, kein „dicker“ Neon-Rand.
2. Header:
   - Hintergrund entspricht „dark card“ statt rein schwarz.
3. CI Lite:
   - Bei gesetztem **Edge Admin Key** + **GitHub PAT** sollten Runs/Logs auch auf privaten Repos nicht mehr 404/502 liefern
   - Falls Logs noch nicht bereit: „Logs noch nicht verfügbar …“ statt rotem Hard-Fail.


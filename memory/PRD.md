# PRD - K1W1 APK Builder

## Architecture
- React Native / Expo (TypeScript)
- Supabase Backend, GitHub Integration, EAS Build System

## What's Been Implemented (Jan 2026)

### Session 5: One-Click Deploy + Visual Hot Reload Feedback
- **One-Click Deploy** im BuildScreen:
  - `useOneClickDeploy` Hook: Sequentielle Pipeline (Tokens -> Signing Key -> Secrets Sync -> Push Files -> Build)
  - `OneClickDeployCard` UI: Animierte Timeline mit Step-Rows, Pop-in Checkmarks, Pulse fuer Running, Connector-Lines
  - Abort, Retry, Reset Buttons (alles outlined)
  - Jeder Step zeigt Status + Detail-Text
  - `startBuildFn` wird im Hook exportiert fuer den Deploy-Zugriff
- **Visuelles Hot-Reload Feedback** im PreviewScreen:
  - Animierter gruener Flash-Rahmen um den Device Frame bei jedem Hot Reload
  - `flashBorderAnim` interpoliert borderColor, shadowOpacity, shadowColor, shadowRadius
  - Neon-Glow-Effekt der ueber 800ms ausblendet

### Session 4: Hot Reload Preview
- `usePreview` Hook: `filesFingerprint` (DJB2-Hash)
- PreviewScreen: Auto-Reload bei Datei-Aenderungen (1.2s Debounce)

### Session 3: Echter PreviewScreen
- Eingebettete WebView, Device Frame, Auto-Create

### Session 2: Button-Overhaul + Screen-Redesign
- Alle Buttons outlined, Mode auto vom BuildScreen

### Session 1: Initiale Aenderungen
- StorageKeys, Laempchen, Checklist, Progress Bar

## Backlog
### P1
- [ ] Git Diff Integration
- [ ] Auto-Fix innerhalb One-Click Deploy erweitern (EAS ID erstellen, Typecheck)
### P2
- [ ] Push-Benachrichtigungen nach Build
- [ ] Erweiterte Animationen

# PRD - K1W1 APK Builder

## Problem Statement
UI/UX Polish fuer den automatischen APK Builder. Neon/Giftgruen/Dark Optik.
Outlined Buttons, automatischer Mode, echter Preview Screen.

## Architecture
- React Native / Expo (TypeScript)
- Supabase Backend
- GitHub Integration
- EAS Build System

## What's Been Implemented (Jan 2026)

### Session 3: Echter PreviewScreen
- **PreviewScreen komplett neu gebaut:**
  - Eingebettete WebView zeigt die App direkt im Screen
  - Device Frame (sieht aus wie ein Handy-Bildschirm)
  - Auto-Create: Preview wird automatisch beim Oeffnen erstellt
  - Live Status-Bar mit Puls-Animation (Erstellen -> Laden -> Live)
  - Toolbar: Reload, Copy URL, im Browser oeffnen, Fullscreen
  - Error Bar mit Retry
  - Bottom Actions: Neu erstellen / Zuruecksetzen
  - Alle Buttons outlined (keine voll-gruenen)

### Session 2: Button-Overhaul + Screen-Redesign
- Alle Buttons global auf outlined umgestellt
- BuildScreen: Repo-Info read-only, Dropdown Build-Mode
- CredentialWizard + DiagnosticScreen: Mode auto vom BuildScreen
- DiagnosticScreen: Animierte Issue-Rows

### Session 1: Initiale Aenderungen
- StorageKeys erweitert
- ConnectionsScreen: Laempchen + Persistenz
- Checklist + Progress Bar im BuildScreen

## Backlog
### P1
- [ ] Auto-Fix Logic im BuildScreen
- [ ] Git Diff Integration
### P2
- [ ] Erweiterte Animationen
- [ ] Push-Benachrichtigungen nach Build

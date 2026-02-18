# PRD - K1W1 APK Builder

## Problem Statement
UI/UX Polish fuer den automatischen APK Builder. Neon/Giftgruen/Dark Optik.

## Architecture
- React Native / Expo (TypeScript)
- Supabase Backend, GitHub Integration, EAS Build System

## What's Been Implemented (Jan 2026)

### Session 4: Hot Reload Preview
- `usePreview` Hook: `filesFingerprint` berechnet DJB2-Hash der Projektdateien
- PreviewScreen: Automatischer Hot Reload bei Datei-Aenderungen
  - 1.2s Debounce, Toggle ein/aus, Blink-Animation, Reload-Counter
  - Device Frame, Auto-Create, Fullscreen, Copy URL, Browser oeffnen

### Session 3: Echter PreviewScreen
- Eingebettete WebView, Device Frame, Auto-Create, Status-Bar

### Session 2: Button-Overhaul + Screen-Redesign
- Alle Buttons outlined, Mode auto vom BuildScreen

### Session 1: Initiale Aenderungen
- StorageKeys, Laempchen, Checklist, Progress Bar

## Backlog
### P1
- [ ] Auto-Fix Logic im BuildScreen
- [ ] Git Diff Integration
### P2
- [ ] Push-Benachrichtigungen nach Build

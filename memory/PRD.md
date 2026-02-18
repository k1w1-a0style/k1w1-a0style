# PRD - K1W1 APK Builder

## Problem Statement
UI/UX Polish fuer den automatischen APK Builder. Neon/Giftgruen/Dark Optik mit Animationen.
Outlined Buttons statt voll-gruen. Mode automatisch vom BuildScreen in alle Screens.

## Architecture
- React Native / Expo (TypeScript)
- Supabase Backend
- GitHub Integration (Actions, Repos, Branches)
- EAS Build System

## Core Requirements
1. **Buttons**: Gruene Raender, NICHT voll-gruen (outlined)
2. **Build-Screen**: Repo-Info read-only, Dropdown fuer Build-Mode, Progress-Balken
3. **Credential Wizard**: Kein Mode-Auswahl - automatisch vom Build-Screen
4. **Diagnostic Screen**: Kein Mode-Auswahl - automatisch vom Build-Screen, animierte Testliste
5. **Connections Screen**: Laempchen mit persistentem Status
6. **Repos Screen**: Dropdown fuer Repo/Branch

## What's Been Implemented (Jan 2026)

### Session 1: Initiale Aenderungen
- StorageKeys erweitert (persistent connection + credential status)
- ConnectionsScreen: Laempchen + GitHub Account Name + Persistenz
- EnhancedBuildScreen: History/Actions entfernt, Checklist + Progress Bar
- CredentialsWizard: Auto-Mode, keine Auswahl
- DiagnosticScreen: Persistent Ergebnis-Status
- BranchSelector als Dropdown

### Session 2: Button-Overhaul + Screen-Redesign
- **ALLE Buttons global auf outlined umgestellt:**
  - EnhancedBuildScreen (Build starten, URLs, Download)
  - CredentialsWizardScreen (Generieren, Status pruefen)
  - DiagnosticScreen (Diagnostik starten, Autofix)
  - SettingsScreen (Key hinzufuegen, Rotieren, Notify)
  - GitHubReposScreen (Action Buttons)
  - PreviewScreen (Preview Buttons)
  - ChatScreen (Accept/Reject, Send, Scroll-to-bottom)
  - ChatComposer (Send Button)

- **BuildScreen komplett neu:**
  - Repo-Info nur als Badge (read-only, kein Input)
  - Build-Mode als Dropdown statt Segment-Buttons
  - Integrierter Header
  - Saubere Sektion-Trennung

- **BuildStatusSection neu:**
  - Eigene Card mit Ionicons statt Emojis
  - Outlined Action-Buttons (GitHub Run, Artifacts, Download)
  - Outlined Start-Button
  - Timeline-Integration

- **CredentialsWizard ModeSection:**
  - Kein Mode-Selektor mehr
  - Mode-Badge zeigt aktiven Modus (read-only)
  - Info-Text "Vom Build-Screen uebernommen"

- **DiagnosticScreen:**
  - HeaderSection: Mode-Badge statt Selektor
  - IssuesTabSection: ModeSelector entfernt, animierte Issue-Rows
  - NonIssuesTabSection: ModeSelector entfernt
  - Button-Icons auf primary umgestellt

## Prioritized Backlog

### P0 (Done)
- [x] Outlined Buttons global
- [x] Mode-Auswahl entfernt aus Credential + Diagnostic
- [x] Build-Screen vereinfacht (read-only Repo, Dropdown Mode)
- [x] Connection Lights persistent

### P1 (Next)
- [ ] Auto-Fix Logic (Pre-Build automatisch alles fixen)
- [ ] EAS ID automatisch erstellen/linken
- [ ] Secrets automatisch pushen
- [ ] Push vor Build automatisch

### P2 (Future)
- [ ] Git Diff Integration fuer DiffSection
- [ ] Erweiterte Animationen
- [ ] Custom Loading Spinners

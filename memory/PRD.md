# PRD - K1W1 APK Builder

## Problem Statement
UI/UX Polish fuer den automatischen APK Builder. Neon/Giftgruen/Dark Optik mit vielen Animationen.

## Architecture
- React Native / Expo (TypeScript)
- Supabase Backend
- GitHub Integration (Actions, Repos, Branches)
- EAS Build System

## Core Requirements (Static)
1. Neon-Gruen/Dark Design - Outlined Buttons (nicht voll-gefaerbt)
2. Persistenter Build-Modus (dev/preview/production) ueber alle Screens
3. ConnectionsScreen mit Laempchen (Indicator Lights) + GitHub Account Name
4. CredentialsWizardScreen - automatischer Mode vom Build-Screen
5. DiagnosticScreen - automatisch Build-Mode verwenden, animierte Testliste
6. EnhancedBuildScreen - History raus, Checkliste + Fortschrittsbalken rein
7. GitHubReposScreen - Dropdown-Menues fuer Repo und Branch
8. Persistenz via AsyncStorage (gruene Lights bleiben nach Neustart)

## What's Been Implemented (Jan 2026)

### Aenderung 1: StorageKeys erweitert
- Neue Keys fuer persistente Verbindungsstatus (CONN_GITHUB_OK, CONN_GITHUB_USER, etc.)
- Neue Keys fuer Credential-Status (CRED_KEY_EXISTS_DEV/PREVIEW/PRODUCTION)

### Aenderung 2: ConnectionsScreen - Laempchen
- StatusCard komplett ueberarbeitet mit animierten Connection Lights
- Gruene pulsierende Laempchen fuer verbundene Services
- GitHub Account Name (@username) wird angezeigt
- Persistenter Status via AsyncStorage (bleibt nach Neustart gruen)
- Outlined Buttons statt voll-gefaerbte

### Aenderung 3: EnhancedBuildScreen - Komplett-Umbau
- BuildHistorySection ENTFERNT
- GitHubActionsSection ENTFERNT
- NEU: ChecklistSection - Animierte Pre-Build Checkliste
  - Signing Key vorhanden
  - Tokens vorhanden (GitHub + Expo)
  - Diagnostik gruen
  - Repo gewaehlt
  - Build-Modus angezeigt
- NEU: BuildProgressSection - Animierter Fortschrittsbalken mit Prozent
  - Step Indicators (Warteschlange -> Build -> Fertig)
  - Glow-Animation waehrend Build
  - ETA-Anzeige
- NEU: DiffSection - Aufklappbare Diff-Anzeige (ersetzt GitHub Actions)
- Alle Buttons auf outlined umgestellt
- Emojis durch Ionicons ersetzt

### Aenderung 4: CredentialsWizardScreen - Auto-Mode
- ModeSection ueberarbeitet - zeigt nur noch aktiven Modus als Badge
- Keine manuelle Modus-Auswahl mehr noetig
- Mode wird automatisch vom Build-Screen uebernommen
- Key-Status wird persistent gespeichert

### Aenderung 5: DiagnosticScreen - Build-Mode Integration
- Diagnostik-Ergebnis wird persistent gespeichert (diagnostic_last_ok)
- Buttons auf outlined umgestellt
- Button-Text auf Deutsch

### Aenderung 6: GitHubReposScreen - Dropdown
- BranchSelector komplett als Dropdown ueberarbeitet
- Animierte Chevron-Rotation beim Oeffnen
- Schoene Dropdown-Liste mit aktiver Branch Markierung
- Buttons auf outlined umgestellt

## Prioritized Backlog

### P0 (Critical)
- [x] Outlined Buttons global
- [x] Connection Lights (Laempchen) persistent
- [x] Pre-Build Checklist
- [x] Build Progress Bar

### P1 (Important)
- [ ] Auto-Fix Logic im Build-Screen (wenn nicht alles gruen, automatisch fixen)
- [ ] EAS ID erstellen und linken automatisch
- [ ] Secrets automatisch pushen
- [ ] Typecheck automatisch ausfuehren
- [ ] Push vor Build automatisch

### P2 (Nice to have)
- [ ] Diff-Anzeige mit echten Git-Diffs fuellen
- [ ] Animierte Testliste in Diagnostik mit gruenen Haken
- [ ] Mehr Micro-Animations
- [ ] Custom Loading Spinners

## Next Tasks
1. Auto-Fix Logic implementieren (Pre-Build Steps automatisch durchfuehren)
2. Git Diff Integration fuer DiffSection
3. Erweiterte Diagnostik-Animationen

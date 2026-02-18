# Patch 185

## Fokus
- Repo-Screen als zentrale Schaltzentrale: Repo/Branch wählen, Secrets ansehen, Diff-Dateiliste ansehen.
- Build-Screen auf “Build starten & Status” reduziert (GitHub Actions UI entfernt).
- Diagnostic-Screen zeigt das aktuell persistierte Profil als deutliche Überschrift + Debug-Button (prefill in Chat).

## Änderungen
### GitHubReposScreen
- Header auf Dropdown-Flow umgebaut (Repo wählen per Roll-Down).
- Schnell-Buttons: **+** (neues Repo), **Stift** (Rename), **Papierkorb** (Repo löschen), **Refresh**.
- Neue Sektionen:
  - **Repo Info** (User/Repo + Open auf GitHub)
  - **Secrets** (Names + erwartete Standard-Secrets als Checkliste)
  - **Diff Dateien** (Base=Default-Branch → Head=aktiver Branch) inkl. Vorschau.

### EnhancedBuildScreen
- GitHub Actions Sektion aus dem Screen entfernt (Workflow Runs UI).

### DiagnosticScreen
- Header zeigt Profil prominent (DEV/PREVIEW/PRODUCTION bzw. Multi).
- Debug-Button: legt eine zusammengefasste Fehlerliste als Prefill in den Chat.

## Files
- `infra/github/compare.ts` (neu)
- `infra/github/user.ts` (neu)
- `infra/github/githubService.ts` (exports erweitert)
- `screens/GitHubReposScreen/components/HeaderSection.tsx` (UI)
- `screens/GitHubReposScreen/components/RepoMetaSection.tsx` (neu)
- `screens/GitHubReposScreen/components/SecretsSection.tsx` (neu)
- `screens/GitHubReposScreen/components/DiffFilesSection.tsx` (neu)
- `screens/GitHubReposScreen/index.tsx` (Flow clean)
- `screens/EnhancedBuildScreen/index.tsx` (Actions UI raus)
- `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts` (HeaderStats erweitert)
- `screens/DiagnosticScreen/components/HeaderSection.tsx` (Profil + Debug)
- `screens/DiagnosticScreen/index.tsx` (Debug to Chat)
- `screens/ChatScreen/hooks/useChatScreen.ts` (prefillText support)

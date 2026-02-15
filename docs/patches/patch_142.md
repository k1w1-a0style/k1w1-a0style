# Patch 142: Selection Sync + Glow + CI Lite Hotfix

Datum: 2026-02-15

## Ziel
- **Repo/Branch Auswahl überall übernehmen**: Header, Diagnostics, Credential Wizard, Build Screen usw. sollen dieselbe Auswahl anzeigen/nutzen.
- **Selection Glow** (Neon Giftgrün / Dark) als klares visuelles Feedback.
- **Patch 141 Hotfix**: TypeScript-Fehler im CI-Lite Header Button beheben.

## Änderungen

### CI Lite (Hotfix)
- `components/CiLiteHeaderButton.tsx`
  - `stopPolling` und `findRunByJobId` vor die ersten `useEffect`/Deps gezogen (Hook-Order bleibt stabil).
  - Damit ist `npm run typecheck` wieder grün.

### Single Source of Truth: Repo/Branch Sync
- `contexts/GitHubContext.tsx`
  - GitHubContext spiegelt jetzt **nach Hydration** automatisch `projectData.linkedRepo` / `projectData.linkedBranch`.
  - Effekt: **CustomHeader + alle Screens**, die `useGitHub()` nutzen, zeigen zuverlässig die Projekt-Auswahl.

### Selection Glow / Lämpchen
- `components/RepoListItem.tsx`
  - Aktives Repo bekommt Neon-Rand + Glow + kleines "Lamp".
- `screens/GitHubReposScreen/components/BranchSelector.tsx`
  - Aktiver Branch-Pill bekommt Neon-Background + Glow.
- `styles/enhancedBuildScreenStyles.ts`
  - Aktives Build-Profil bekommt Neon-Glow.

## Verifikation
Lokal im Repo-Root:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Ergebnis
- Repo/Branch Auswahl ist konsistent über die App.
- Auswahl ist sichtbar (Glow/Lamp).
- Patch 141 TS-Fehler beseitigt.

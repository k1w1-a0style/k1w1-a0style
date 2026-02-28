# Patch 304: RepoScreen EAS-Link UI compile fix

## Was gefixt wurde

- **TypeScript/ESLint Build-Breaker** im `GitHubReposScreen` behoben:
  - fehlende Imports: `useEffect`, `Pressable`, `TextInput`
  - `pressed` im `Pressable`-Style-Callback sauber typisiert (kein implicit `any`)
- **Repo öffnen Button** im EAS-Link-Block ruft wieder korrekt `handleOpenRepoOnGitHub()` auf (die Funktion nimmt keine Parameter).

## Warum

Patch 303 hat den EAS-Link UI-Block zurückgebracht, aber ein paar Imports/Types vergessen. Das hat:
- `tsc --noEmit` gebrochen
- ESLint (`react/jsx-no-undef`) gebrochen
- und dadurch die RepoScreen Tests gekillt.

## Dateien

- `screens/GitHubReposScreen/index.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_304.md`

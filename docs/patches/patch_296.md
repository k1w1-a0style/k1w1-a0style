# Patch 296

## RepoScreen: Diff UX “geiler”

### Verbesserungen
- **Inline Diff Expand** direkt unter der Datei (Tap auf Datei klappt auf/zu).
- Toggle **Inline/Modal** (Inline default, Modal weiterhin für Full-Details).
- **Unified Diff farblich**: `+` grün, `-` rot, Header/Trenner gedimmt.
- **Context/Komprimierung**: Große Diffs werden automatisch gekürzt und zeigen nur relevante Bereiche rund um Änderungen.
- Copy-Buttons: **Diff kopieren** (Inline) + **Details** öffnet den Modal-Viewer.

### Betroffene Dateien
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`

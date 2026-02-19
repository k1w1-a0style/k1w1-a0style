# Patch 218 — Connections/SoT Feinschliff + UX Edge Cases

Stand: **2026-02-19**

## Ziel

- Connected-Status bleibt **persistent**, aber wird auch **korrekt zurückgesetzt**, wenn Tokens gelöscht werden.
- GitHub Scopes werden **best-effort** gespeichert und angezeigt; wenn Header fehlt → **Scopes: unknown**.
- Kleine Robustness-Fixes (deps / stale-closure) im Connection Hook.

## Änderungen (Code)

### ConnectionsScreen
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
  - `CONN_GITHUB_SCOPES` wird beim Mount geladen.
  - `saveAll`: Wenn GitHub/Expo/Supabase Inputs geleert werden → passende `CONN_*` Flags/Details werden zurückgesetzt.
  - `testGitHub`: bei Fehler werden `USER/SCOPES` ebenfalls gelöscht.
  - `testSupabase`: deps enthalten jetzt `supabaseServiceRoleKey`.

- `screens/ConnectionsScreen/components/StatusCard.tsx`
  - GitHub-Detail zeigt bei verbundenem Status ohne Header: **Scopes: unknown**.

## Änderungen (Docs)

- `docs/TODO.md`: Patch 217 als done, Patch 218 als next + abhakbare Detail-Tasks.
- `docs/patches/PATCHLOG_ROOT.md`: Patch 218 Eintrag.
- `PROJECT_CHECKLOG.md`: Patch 218 pending.
- `README.md`: Patch-Status aktualisiert.

## Commands (wie im Terminal-Screenshot)

```bash
unzip -o k1w1-a0style_patch_218.zip -d .
rm -f k1w1-a0style_patch_218.zip

npm run typecheck
npm run lint:ci
npm run test:silent

git add -A
git commit -m "Patch 218: connection SoT reset rules + GitHub scopes persistence + small robustness fixes"
git push
```

## Akzeptanzkriterien

- Typecheck/Lint/Tests grün.
- GitHub: nach Test → Username + Scopes (oder unknown) persistieren über Restart.
- GitHub Token löschen → GitHub/Repo/EAS Lampen gehen aus und bleiben aus.
- Expo Token löschen → Expo Lampe aus.
- Supabase URL/ANON löschen → Supabase Lampe aus.

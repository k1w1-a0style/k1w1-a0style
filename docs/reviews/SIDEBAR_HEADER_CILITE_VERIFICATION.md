# Verification: Sidebar + Header + CI Lite (Patch 178)

## Scope
- Drawer/Sidebar visual polish (thin borders, consistent green)
- Header background & action buttons (no pure-black mismatch)
- CI Lite GitHub Actions logs: private repo support via token passthrough + workflow fallback

## Manual checks
1) Drawer:
- Open drawer
- Active item: subtle green tint, *no* fat neon border
- Borders look hairline (especially item cards/chips)

2) Header:
- Header background matches dark-card tone (not pitch black)
- Menu / Preview / CI Lite buttons look consistent with chat styling

3) CI Lite:
Preconditions:
- Edge Admin Key set (Credentials Wizard / SecureStore)
- GitHub PAT set (repo access + Actions read)

Steps:
- Tap CI Lite button
- Expect: runs list loads or "logs not ready" info state
- If misconfigured: error should explain missing access/token rather than generic crash

## Automated
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

# Patch 219 — AI Provider Hardening + Docs/Examples SoT + Connections Polish

Date: 2026-02-19

## Goals
- Fix issues from k1w1-analyse.md review: phantom model defaults, OpenAI payload field, Gemini conversation format, SecureKeyManager monkey-patch risk.
- Docs/Examples SoT polish (no more hardcoded edge function names in workflow docs examples).
- Connections status UI polish (GitHub scopes nicer + Supabase ref visible).

## Changes

### AI / Orchestrator
- **contexts/AIContext.tsx**
  - Replace non-existent default model IDs (OpenAI/Anthropic) with real IDs.
  - Remove runtime monkey-patching of `SecureKeyManager.rotateKey` and use a listener hook instead.
- **lib/SecureKeyManager.ts**
  - Add rotation listener API (`addRotationListener`) and notify on rotation.
- **lib/orchestrator.ts**
  - OpenAI: remove unsupported `text.verbosity` field.
  - Gemini: send proper multi-turn `contents[]` and `systemInstruction` (instead of flattening everything into one string).
  - Quality mapping: `review` now maps to provider quality default.

### SoT / Docs
- **.github/workflows/README.md**
  - Examples now reference `SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD` instead of hardcoded strings.

### Connections UI
- **screens/ConnectionsScreen/components/StatusCard.tsx**
  - GitHub scopes formatted and missing common scopes indicated.
  - Supabase project ref displayed when available.
- **screens/ConnectionsScreen/index.tsx** + **hooks/useConnectionsScreen.ts**
  - Wire `supabaseRef` through to StatusCard.

### Cleanup
- **lib/fileWriter.ts**
  - Remove substring “quick check” that caused false-positive references.
- **contexts/ProjectContext.tsx**
  - Replace console.log spam with `logger.info`.
- **hooks/useChatAIFlow.ts**
  - Make raw extraction helper stable (no useCallback deps churn).

## Commands (wie im Terminal)

```bash
unzip -o k1w1-a0style_patch_219.zip -d .
rm -f k1w1-a0style_patch_219.zip

npm run typecheck
npm run lint:ci
npm run test:silent

git add -A
git commit -m "Patch 219: AI provider hardening + docs/examples SoT polish + Connections polish"
git push
```

## Verification checklist
- [ ] App startet ohne Modell-404s bei Default-Einstellungen
- [ ] 429 Rotation persistiert nach Neustart (Key order bleibt)
- [ ] Gemini liefert konsistente Multi-turn Antworten (Systemprompt wirkt)
- [ ] Connections: Scopes werden hübsch angezeigt + Supabase Ref sichtbar


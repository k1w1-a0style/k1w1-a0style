# Patchlog (root)

This file is append-only. Each patch adds a short entry.

## Patch 213
- Fix missing `githubApiUrl` import in Connections screen.

## Patch 214
- Fix GitHub repo/branch source-of-truth drift (backup import + CI Lite precedence).

## Patch 215
- Centralize GitHub AsyncStorage keys + Supabase Edge function names to prevent SoT drift.

## Patch 216
- Docs: consolidate TODO + patch workflow commands; align checklog with patch flow.

## Patch 217
- CI Lite bugfixes (dead code + stale closures + polling cleanup) + Supabase edge SoT expansion + Storage key SoT + tokenStore consistency + Connection Screen SoT (persistenter Verbunden-Status, EAS init/link prompt) + optional GitHub token scopes.

## Patch 218
- Connections/SoT Feinschliff (Scopes persist + reset rules + deps fix)

## Patch 219
- AI Provider hardening (remove phantom model defaults, fix OpenAI request payload, proper Gemini multi-turn) + SecureKeyManager rotation listener (no monkey-patch) + file reference check precision + logger cleanup + Docs/Examples SoT polish + nicer Connections status (scopes + Supabase ref).

## Patch 220
- Remove KI-Model “auto” option (kein Auto-Mode mehr in Settings/UI). Legacy-Configs werden beim Laden sauber auf konkrete Default-Modelle gemappt.


## Patch 221
- Connections UX polish (GitHub scopes as badges + missing-scope warning) + Build/CI shortcut + Supabase ref/host display cleanup + docs/todo alignment.

## Patch 222
- Android-only cleanup (keine iOS Pfade/UX-Annahmen) + Repo/Build UX Korrekturen (interner Patch).

## Patch 223
- CI Lite: Persistenter OK-Status (TS + ESLint) + Anzeige als Checklist-Item im EnhancedBuildScreen.

## Patch 224
- CI Lite: “Send to Chat” (Fehler als Chat-Message) + Run-Meta Anzeige (Run#, Status, Conclusion, Duration).
- Connections: Sync Summary Modal (zeigt was beim Sync passiert / welche Secrets-Keys betroffen sind).
- Repo Hygiene: OpenAI NPM dependency entfernt (unused) + App.tsx Tab/Space Cleanup.

## Patch 225
- Fix Gemini: guard gegen leere `contents` (400 vermeiden).
- Supabase Edge URL: kein Hardcode mehr, sondern ENV/derived.
- Logger: Hotspots statt `console.log` (prod-clean).
- Remove legacy `exportAndBuild` aus ProjectContext API.

## Patch 225.1
- Logger: keine gebundenen console-methods (Jest spy friendly).

## Patch 226
- Replace remaining noisy `console.log/warn` in core runtime code mit `logger` (GitHub/Storage Hooks).
- GitHub repo pull: binary-skip logs nur noch in dev.


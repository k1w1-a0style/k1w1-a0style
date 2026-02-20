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
- Android-only cleanup: remove iOS wording from diagnostics; keep guard that treats partial ios/ as risky.
- CI Lite status persistence: CI Lite (lint/typecheck) now writes success flags to AsyncStorage and Build checklist shows it as an optional green check.

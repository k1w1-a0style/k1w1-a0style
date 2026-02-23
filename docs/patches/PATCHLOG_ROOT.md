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
- Android-only cleanup (keine Nicht-Zielplattform-Pfade/UX-Annahmen) + Repo/Build UX Korrekturen (interner Patch).

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

## Patch 226.2
- Hotfix: kaputtes Import-Block-Format in `hooks/useGitHubRepos.ts` repariert (TS/Jest Parser wieder grün).

## Patch 227
- CI Lite: `applyPatchFromText` deps vollständig (stale-closure Guard bei Repo/Branch-Wechsel).
- Docs: Patchnote + Patchlog/Checklog synchronisiert.

## Patch 228 (2026-02-20)
- Docs: added `docs/DEV_COMMANDS.md` (Commands/Shortcuts) and updated docs index + README to work without `rg`/ripgrep.

## Patch 229 (2026-02-20)
- CI Lite: extracted shared helpers into components/ciLite/ciLiteUtils.ts (SoT).
- CI Lite: applyPatchFromText/selection deps hardened further + minor UX polish.
- Docs: patchnote + patchlog/checklog/readme alignment.
## Patch 230 — Bundle 227–229 (CI Lite SoT + DEV_COMMANDS)

- **Bundle/Apply:** Ein Apply-ZIP, das Patch 227–229 zusammenfasst (CI Lite SoT + DEV_COMMANDS + Docs Alignment).
- Datei: `docs/patches/patch_230.md`


## Patch 231 — Android-only wording cleanup

- Entfernt Nicht-Zielplattform-Wording aus user-facing Docs/Kommentaren, damit kein falscher Eindruck entsteht.
- Datei: `docs/patches/patch_231.md`

## Patch 232 — Android-only guard wording + workflow docs cleanup

- Android-only wording sweep in workflow README + templates + ChatScreen comment.
- Datei: `docs/patches/patch_232.md`

## Patch 233 (2026-02-23)

- Docs/History: removed remaining non-target platform mentions (text-only hygiene).
- Datei: `docs/patches/patch_233.md`


## Patch 234 (2026-02-23)

- Runtime robustness sweep: Gemini consecutive-role merge + Supabase Edge URL guard + legacy provider safety + logger cleanup.
- Datei: `docs/patches/patch_234.md`

## Patch 235 (2026-02-23)

- Post-234 cleanup: HF indent + safer fallbacks + Supabase error const + logger hygiene.
- Datei: `docs/patches/patch_235.md`

## Patch 236 (2026-02-23)

- Hotfix: fixed malformed import block in WorkflowRunDetailModal + replaced console log with logger.
- Datei: `docs/patches/patch_236.md`


## Patch 237 (2026-02-23)

- UI/Metadata: removed placeholder model `contextWindow: '—'` (kept real values only).
- Datei: `docs/patches/patch_237.md`

## Patch 238 (2026-02-23)

- Fix tests: add minimal `contextWindow` values per provider (use real sizes where known, otherwise `varies`).
- Datei: `docs/patches/patch_238.md`

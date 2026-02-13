# TerminalScreen – Verification (Patch 78)
> Hinweis: Gemeinsame Übersicht aller Verifikationen: `docs/reviews/SCREENS_VERIFICATION.md`
Stand: 2026-02-13

## Patch 91 Hinweis
- Patch 91 hat **keine** TerminalScreen-Änderungen gemacht (nur GitHubReposScreen Parsing/Refresh Hardening + Tests).
- Patch 92 hat **keine** TerminalScreen-Änderungen gemacht (nur GitHubReposScreen whitespace-Guard).

## Patch 93 Hinweis
- Patch 93 ist Docs/Reports (TODO + Status-Docs), **keine** TerminalScreen-Änderungen.


## 1) Review-Check: Was stimmt, was nicht?

### ✅ Zutreffend (im Code wirklich so gefunden)

- **TS-001 (P1) Secrets/PII-Leak über Terminal-Logs (UI/Copy/Export/AI)**
  - Vor Patch: Logs wurden ungefiltert gespeichert und konnten via Copy/Export/Share oder AutoFix an den Provider gehen.
  - Risiko: API Keys, Tokens, URLs, Request-Bodies usw. können real in Logs landen.

- **TS-002 (P1) Unbounded/Heavy Log Payloads (UI Freeze / OOM / slow export)**
  - Vor Patch: Export/Copy baut große Strings ohne harte Caps.
  - Risiko: Android kann bei sehr langen Logs spürbar hängen.

### ⚠️ “Kommt drauf an” (aber sinnvoll als Hardening)

- **TS-003 (P2) RAF batching ohne Unmount-Cancel**
  - Selten, aber sauberer: RAF cleanup + mounted-guard.

## 2) Ändert das die Screen-Optik?

**Nein.** Layout bleibt gleich.

Was sich ändert:
- In Terminal-UI, Clipboard, Export, Share und AI-Payload werden Secrets **automatisch redacted**.
- Sehr lange Log-Zeilen werden **gecappt** (mit Marker `… <truncated>`), damit keine Monster-Strings entstehen.

## 3) Patch 75 – Fix + Hardening + Tests + Docs Sync

✅ **Redaction überall** (Speicher, UI, Copy, Export, Share, AutoFix)
- `redactSecrets()` entfernt typische Tokens/Keys/JWT/Bearer/`apiKey=` etc.

✅ **Perf-Caps**
- Per-Log max chars + Marker
- Export-/Copy-/AI-Payload caps (max logs + max chars)

✅ **Stabilität**
- RAF batching bekommt Cleanup/Unmount-Guard.

✅ **Tests**
- Neue Unit-Tests für Secret-Redaction + Truncation.

✅ **Docs**
- `docs/TODO.md` und `PROJECT_CHECKLOG.md` aktualisiert.
- Patch Notes: `docs/patches/PATCH_75_NOTES.md`

## 4) Manuelle Smoke-Checks

1. Terminal öffnen → viele Logs erzeugen (inkl. langen Zeilen).
2. Long-press Copy → im Clipboard dürfen keine Tokens/Keys sichtbar sein.
3. Export → Datei wird erzeugt, keine Freeze, Inhalt redacted.
4. AutoFix → Request payload enthält redacted Logs.

---

## Patch 76 Follow-up

**Why:** Patch 75 introduced a build break in `LogRow` (non-existent theming helpers) and redaction/truncation output differed from unit test expectations.

**Fixes:**
- Removed imports of non-existent theming hooks and switched to static `theme` + `StyleSheet`.
- Redaction: preserve `Bearer ` prefix; add `<redacted-jwt>` marker for JWT-like tokens.
- Truncation: ensure `truncateWithMarker()` never returns a string longer than the requested max.

**Result:** `npm run typecheck`, `npm run lint:ci`, and `npm run test:silent` pass again.

---

## Patch 77 Follow-up

**Why:** Patch 76 still had (1) a redaction ordering issue where the generic `Authorization:` rule would override the earlier `Bearer <redacted>` output and (2) a LogRow typing/theme mismatch (`LogEntry` doesn’t have `tsLabel/level`; `theme.palette.text` is an object).

**Fixes:**
- `secretRedaction`: generic `Authorization:` redaction now skips values that start with `Bearer ` so the scheme remains visible.
- `LogRow`: derive `tsLabel` from `timestamp`, map `level` from `type`, and use `theme.palette.text.primary/muted`.

**Result:** `npm run typecheck`, `npm run lint:ci`, and `npm run test:silent` should be green.

---

## Patch 78 Follow-up

**Why:** Patch 77 still had (1) `useMemo` not imported in `LogRow` and (2) `Bearer` redaction still overridden in some cases.

**Fixes:**
- `LogRow`: import `useMemo` correctly.
- `secretRedaction`: ensure `Authorization: Bearer <token>` becomes `Authorization: Bearer <redacted>` (scheme preserved, token removed).

**Result:** `npm run typecheck`, `npm run lint:ci`, and `npm run test:silent` are green.

---

## Patch 79 / 80 Note

- Patch 79: no TerminalScreen changes (GitHubReposScreen only).
- Patch 80: no TerminalScreen changes (ChatScreen/Jest cleanup only).

## Patch 81
No TerminalScreen changes in this patch. Previous verification remains valid.

## Patch 82 / 83 / 84
No TerminalScreen changes in these patches (ConnectionsScreen hardening + hotfixes only). Previous verification remains valid.

## Patch 85
No TerminalScreen UI changes. `lib/secretRedaction` is now also used to sanitize **Build logs** (defense-in-depth), but Terminal behavior stays the same.

---

## Patch 86
- No changes in TerminalScreen behavior or UI (file kept current).

## Patch 87
- No TerminalScreen changes. (Supabase/migration + Edge error sanitization only.)

Note (Patch 92): No changes to TerminalScreen; verification remains valid.
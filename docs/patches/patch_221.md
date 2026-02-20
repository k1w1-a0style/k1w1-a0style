# Patch 221 — Connections UX + Docs SoT-Polish

Datum: **2026-02-20**

## Ziel

- Connection-Status sofort verständlich (Scopes als Badges + Missing-Scope Warnung)
- Quick-Shortcuts direkt aus dem Connection-Screen
- Supabase Anzeige klarer (Ref/Host) + weniger „auto“ Verwirrung
- TODO/Docs: erledigte Punkte als erledigt markieren + neue Next-Steps sichtbar

## Änderungen (high level)

- `StatusCard`:
  - GitHub Scopes werden als Badges dargestellt
  - Warnung wenn typische Required-Scopes fehlen (`repo`, `workflow`)
  - zusätzlicher Shortcut-Button: **Build/CI** (Route: `EnhancedBuild`)
  - EAS: zeigt „Workflow läuft…“ wenn Init/Link aktiv ist
  - Supabase: zeigt `supabaseRef` als value + Host in Detail

- `SupabaseCard`:
  - Label angepasst: **"Supabase URL (abgeleitet)"**

- Docs:
  - `docs/TODO.md` aktualisiert (alte Tasks ✅, Patch 221 als Next)

## Patch anwenden

```bash
# 1) ZIP entpacken
unzip -o k1w1-a0style_patch_221.zip -d .

# 2) ZIP löschen
rm -f k1w1-a0style_patch_221.zip

# 3) Checks
npm run typecheck
npm run lint:ci
npm run test:silent

# 4) Commit + Push
git add -A
git commit -m "Patch 221: Connections UX polish (scopes badges + CI shortcut) + docs/todo alignment"
git push
```

## Akzeptanz

- GitHub Status zeigt Scopes als Badges (oder "unknown"), inkl. Missing-Warnung falls nötig
- Connection Screen hat Buttons: Repos / Build/CI / Diagnose
- Supabase zeigt Ref + Host konsistent
- Docs/TODO stimmen mit realem Stand überein

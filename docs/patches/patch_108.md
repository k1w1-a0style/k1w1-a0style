# Patch 108 — Supabase Test + New Architecture Warnungen

## Änderungen

### ConnectionsScreen
- Supabase-Test prüft `build_jobs` jetzt **robust**:
  - Nutzt **Service-Role Key** (falls vorhanden) für den Table-Check.
  - Wenn nur **anon** vorhanden ist und die Tabelle durch RLS geschützt ist, werden **401/403** als *OK (RLS geschützt)* behandelt.

### Diagnostic UI / LayoutAnimation
- `UIManager.setLayoutAnimationEnabledExperimental(true)` wird auf Android **nur** im Old-Architecture-Modus ausgeführt.
  - Verhindert Warn-Spam: „setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.“

## Warum
- Nach RLS-Hardening ist `build_jobs` nicht mehr public lesbar → der bisherige Supabase-Test hat fälschlich „Tabelle fehlt (401)“ angezeigt.
- New Architecture macht den LayoutAnimation-Enable Call wirkungslos und loggt Warnungen; das ist nur Noise.

## Manuelle Verifikation (kurz)
- ConnectionsScreen → „Supabase testen“
  - Mit anon-only: **OK** + Hinweis „RLS geschützt“
  - Mit Service-Role: **OK** ohne Hinweis
- Android Dev Build: keine LayoutAnimation-Warnungen mehr in den Logs.

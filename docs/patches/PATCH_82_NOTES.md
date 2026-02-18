# Patch 82 Notes

## Ziel
Hardening vom ConnectionsScreen (Secrets/UI/Alerts) ohne Layout-Umbruch.

## Änderungen
- Supabase ANON + Service Role Inputs: Eye-Toggle hinzugefügt.
- GitHub Test: Success-Alert zeigt keinen Username mehr.
- Alerts: Error-Text wird vor Anzeige sanitizt (best-effort) via `redactSecrets()` und auf eine feste Länge gekürzt.
- Save: leichte Format-Validation für Tokens/URL (fast-fail mit klarer Meldung).

## Optik
- **Änderung:** Ja – 2 zusätzliche Eye-Icons in der Supabase-Sektion + Service Role bekommt einen kurzen Warn-Hint.

## Files
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- `screens/ConnectionsScreen/components/SupabaseCard.tsx`
- `screens/ConnectionsScreen/index.tsx`
- `docs/reviews/CONNECTIONS_SCREEN_VERIFICATION.md`

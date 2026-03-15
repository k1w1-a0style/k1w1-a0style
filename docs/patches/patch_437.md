# Patch 437 — Preview-Migration-Duplikat konservativ eingeordnet

## Ziel
Bestätigte Doppel-Migration im Preview-Bereich minimal-invasiv bereinigen, ohne riskante Historien-Umschreibung.

## Befund
- `supabase/migrations/20251226140000_fix_previews.sql`
- `supabase/migrations/20251226160000_fix_previews.sql`

Beide Dateien waren byte-identisch (gleicher SHA-256) und damit semantisch redundant.

## Entscheidung
- **Keine Löschung** historischer Migrationen (konservativ, kompatibel zu bereits migrierten Umgebungen).
- Die spätere Datei `20251226160000_fix_previews.sql` wurde in ein **explizites Legacy-No-op** überführt.

## Ergebnis
- Frische Setups führen die Preview-Fix-Logik nur noch einmal aus.
- Die zweite Timestamp-Migration bleibt als historischer Marker erhalten, ist aber nicht mehr irreführend aktiv.
- Intention ist direkt im SQL dokumentiert.

## Tests
Keine zusätzlichen Jest-Tests ergänzt:
- Der Fix ist rein migrationshistorisch/dokumentarisch (keine neue App-Logik).
- Mehrwert stabiler Laufzeit-Tests wäre hier gering gegenüber Wartungskosten.

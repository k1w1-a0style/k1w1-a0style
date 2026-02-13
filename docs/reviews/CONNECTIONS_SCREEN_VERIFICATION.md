# ConnectionsScreen Verification

Stand: **2026-02-13**

## Ziel
ConnectionsScreen verwaltet hochsensitive Tokens/Keys (GitHub/Expo/Edge/Supabase). Der Screen soll:
- Secrets standardmäßig maskieren (secureTextEntry)
- Consistent Reveal/Hide per Eye-Toggle anbieten
- Keine unnötigen Identifiers/Secrets in Alerts ausgeben
- Error-Messages best-effort sanitizen (redact + truncate)

## Patch 82

### ✅ CS-001 (P1): Supabase Keys hatten keinen Eye-Toggle
**Fix:** Supabase ANON + Service Role Inputs haben jetzt denselben Eye-Toggle wie GitHub/Expo/Edge.

**Optik-Änderung:** Ja – es kommen 2 Eye-Icons in der Supabase-Sektion dazu.

### ✅ CS-002 (P2): GitHub Test zeigte Username in Alert
**Fix:** GitHub Test Success zeigt nur noch eine generische OK-Meldung (kein Login).

**Optik-Änderung:** Ja – Alert-Text ist weniger detailliert.

### ✅ CS-003 (P2): Error-Messages ungefiltert
**Fix:** Alerts nutzen jetzt `redactSecrets()` + `truncateWithMarker()` (best-effort) bevor Text angezeigt wird.

### ✅ CS-004 (P2): Keine Format-Validation
**Fix:** Vor `saveAll()` läuft eine leichte Format-Validation (GitHub Prefix/Length, keine Whitespaces, Supabase URL/JWT-Shape). Bei klar ungültigen Inputs wird früh mit verständlicher Message abgebrochen.

## Ergebnis
Patch 82 ist ein Hardening ohne Layout-Umbruch:
- UI bleibt gleich, außer: Supabase Eye-Toggles + kleine Warnung bei Service Role.
- Secrets bleiben default maskiert.
- Alerts sind weniger leak-prone.

## Patch 83 (Hotfix)

### ✅ CS-007 (P1): Typecheck-Break in saveAll()
**Problem:** `validateBeforeSave` ist ein `useMemo`-Result (keine Funktions-Args). In Patch 82 wurde es wie eine Funktion aufgerufen → TS2554.

**Fix:** `saveAll()` nutzt jetzt das memoized Result direkt (`const v = validateBeforeSave;`).

**Optik-Änderung:** Nein.

---

## Patch 97 (Tests + Refactor)

### ✅ CS-006 (P2): Security-/Regression-Tests für Validation & Sanitization
**Was:** Die Validierungs- und Sanitization-Logik ist jetzt als reine Utils ausgelagert (`screens/ConnectionsScreen/utils/validation.ts`) und wird in `__tests__/connectionsScreen.validation.test.ts` abgedeckt.

**Getestet:**
- Supabase URL: Project-ID/URL Normalisierung + Reject bei invalid host/protocol.
- Keys: JWT-Shape requirement + Reject bei Whitespaces.
- Alerts: `safeAlertText()` redacted Tokens/JWT + Truncation Marker.

**Optik-Änderung:** Nein (nur Test + interne Logik-Reuse).

## Patch 84 (Hotfix)

### ✅ CS-008 (P1): validateBeforeSave Shape Drift
**Problem:** Je nach Refactor ist `validateBeforeSave` entweder
- ein memoized Ergebnis-Objekt **oder**
- ein Callback, der dieses Ergebnis-Objekt zurückgibt.

Das führte zu TS-Errors, wenn `saveAll()` die falsche Variante annimmt.

**Fix:** `saveAll()` normalisiert `validateBeforeSave` robust:
- wenn Funktion → wird ohne Args aufgerufen
- sonst → wird direkt als Objekt genutzt

**Optik-Änderung:** Nein.

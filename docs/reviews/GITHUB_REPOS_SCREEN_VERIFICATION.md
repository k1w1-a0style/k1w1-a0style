# GitHubReposScreen Verification

Stand: **2026-02-12**

## Ziel
Der GitHubReposScreen steuert die Auswahl von Repo/Branch/Flow und hat hohe Anforderungen an:
- Konsistenz (ein Selektionspfad)
- Async Sicherheit (stale responses dürfen nicht mehr schreiben)
- UX-Safety (keine Double-Submits)

---

## Review-Findings (kritisch geprüft)

### ✅ RS-001 (P1) – Recent-Pills umgehen den echten Select-Flow
**Problem:** Auswahl über „Recent“-Pills kann State/Modal/UI inkonsistent lassen.

**Fix:** Recent-Auswahl geht jetzt **immer** durch denselben Pfad wie die normale Repo-Auswahl.

**Optik-Änderung:** Nein.

### ✅ RS-002 (P1) – BranchSelector Race / Stale-Responses
**Problem:** Schneller Repo-Wechsel → ein späteres (stales) Ergebnis überschreibt den neuen State.

**Fix:** Generation/Guard (stale responses werden ignoriert).

**Optik-Änderung:** Nein.

### ✅ RS-003 (P1) – Manage-Modal Double-Submit
**Problem:** Confirm-Button bleibt aktiv während async → doppelte Requests.

**Fix:** Busy-Lock + Button/Input disabled + Spinner während Request.

**Optik-Änderung:** Minimal – Spinner/Disabled State während Aktion.

---

## Ergebnis
- Kein Layout-Umbruch.
- Verhalten ist konsistenter und robuster (keine Race Conditions, kein Double-Submit).

# PreviewScreens – Code-Verifikation & Review-Abnahme

Datum: **2026-02-11**  
Scope: `PreviewScreen.tsx` + `PreviewFullscreenScreen.tsx` + `utils/previewNavigation.ts`

Diese Datei dokumentiert die **kritische Prüfung** der Review-Findings (zutreffend vs. nicht) **gegen den tatsächlichen Code** und was sich durch die Fixes ändert.

---

## 1) Review-Check: Was stimmt, was nicht?

### ✅ Zutreffend (im Code wirklich so gefunden)

**F-01 (P1) – Non-http(s) Schemes zu breit (`external_direct` für alles)**  
- Fundstelle: `utils/previewNavigation.ts` – non-http(s) → `external_direct` (ohne Allowlist)  
- Effekt: `PreviewFullscreenScreen` ruft anschließend `Linking.openURL()` direkt auf.  
➡️ **Stimmt.** Fix: **Scheme-Allowlist** (nur sichere Schemes direkt erlauben, Rest blocken).

**F-02 (P1) – Origin-Guard fällt aus bei `baseOrigin=null` (fail-open)**  
- Fundstelle: `utils/previewNavigation.ts` – Same-Origin-Check nur wenn `args.baseOrigin` truthy.  
- Wenn `baseOrigin=null`: http(s) landet im Default `allow`.  
➡️ **Stimmt.** Fix: **fail-closed** (`url`-Mode ohne `baseOrigin` → `block`).

**F-03 (P2) – `originWhitelist` zu permissiv / nicht mode-spezifisch**  
- Fundstelle: `screens/PreviewFullscreenScreen.tsx` – `["https://*", "http://*", "data:*", "about:*", "blob:*"]`.  
➡️ **Stimmt.** Fix: **mode-spezifisch** (html: internal-only, url: nur `baseOrigin` + internal).

**F-04 (P2) – Process-Crash Recovery nur manuell (kein Auto-Reload)**  
- Fundstelle: `PreviewFullscreenScreen.tsx` – Crash setzt Error-Text, User muss manuell reloaden.  
➡️ **Stimmt.** Fix: **one-shot Auto-Recovery** (einmal automatisch reloaden, dann manuell).

**F-05 (P3) – Unnötige `useCallback` Dependencies**  
- Fundstelle: `handleNavigationStateChange` hatte `[mode, baseOrigin]`, nutzt beides nicht.  
➡️ **Stimmt.** Fix: deps auf `[]`.

**F-06 (P2) – Test-Coverage Lücken (kritische Negativfälle ungetestet)**  
- Fundstelle: `__tests__/previewNavigationGuards.test.ts` deckte `baseOrigin=null` & dangerous schemes nicht ab.  
➡️ **Stimmt.** Fix: Tests ergänzt für fail-closed + scheme-blocking + trim.

### ⚠️ Nicht als “Bug”, aber als Hinweis
- In Android-only Kontext ist `onContentProcessDidTerminate` (iOS) weniger relevant – schadet aber nicht, weil es ohne iOS nicht triggert.

---

## 2) Ändert das die Screen-Optik?

**Nein – Layout/Design bleibt gleich.**  
Änderungen sind **Verhalten/Hardening**:

- Klick auf Links mit unsicheren Schemes wird jetzt **geblockt** (statt extern “irgendwas” zu öffnen).
- Ungültige URL im `url`-Mode zeigt jetzt einen **klaren Fehlerzustand** (statt origin-guard “aus”).
- Bei WebView-Prozessabbruch gibt es **einmal Auto-Reload**, danach weiterhin manuell.
- `originWhitelist` ist enger → keine sichtbare UI-Änderung, nur weniger permissiv.

---

## 3) Umgesetzte Fixes (Patch 59)

✅ F-01: Scheme-Allowlist (nur `mailto:`, `tel:`, `sms:`, `geo:`, `maps:` → `external_direct`, sonst `block`)  
✅ F-02: Fail-closed wenn `mode="url"` und `baseOrigin=null` → `block`  
✅ F-03: `originWhitelist` dynamisch/mode-spezifisch  
✅ F-04: One-shot Auto-Recovery bei WebView Process Crash (mit Loop-Schutz)  
✅ F-05: `useCallback` deps bereinigt  
✅ F-06: Tests ergänzt (`baseOrigin=null`, dangerous schemes, trim)

---

## Patch 60 – Typecheck-Fix (keine Logikänderung)
- Fix: `Ionicons` Farbe nutzt jetzt `theme.palette.text.primary` (statt Objekt).
- Fix: falscher Style-Key `topTitleContainer` → `titleContainer`.
- Ergebnis: `npm run typecheck` + Jest laufen wieder grün.

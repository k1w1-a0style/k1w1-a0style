# Kritischer Review: Preview Screens (PreviewScreen + PreviewFullscreenScreen)

**Datum:** 2026-02-10

## Kurzfazit

- Die Grundarchitektur ist solide: `usePreview` hat Singleflight-Schutz, Unmount-Schutz und klaren Supabase→Local-Fallback. 
- Die WebView-Guard-Logik ist vorhanden und testbar ausgelagert (`utils/previewNavigation.ts`), inkl. eigener Unit-Tests.
- Größtes Risiko: **zu breite Behandlung nicht-http(s)-Schemes** (`external_direct` für quasi alles), was unnötige Angriffs-/Missbrauchsfläche öffnet.
- Zweites relevantes Risiko: **`url`-Mode ohne `baseOrigin` lässt alle http(s)-Navigationsziele zu** (Guard-Degradation).
- Stabilitäts-Events für iOS/Android-Prozessabbrüche sind implementiert, aber nur mit manuellem Reload; White-Screen-Szenarien bleiben teilweise UX-abhängig.
- Typing ist insgesamt brauchbar, aber Event-Typen sind bewusst minimal; dadurch fehlen compile-time Garantien auf Request-Details.

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| F-01 | P1 | Security/Hardening | Nicht-http(s)-Schemes werden pauschal als `external_direct` behandelt (zu offen). | `utils/previewNavigation.ts:51-54`, `screens/PreviewFullscreenScreen.tsx:239-253` |
| F-02 | P1 | Correctness/Security | In `url`-Mode ohne `baseOrigin` werden http(s)-Ziele implizit erlaubt (Origin-Guard fällt aus). | `utils/previewNavigation.ts:61-69`, `screens/PreviewFullscreenScreen.tsx:79-87` |
| F-03 | P2 | Security/Hardening | `originWhitelist` ist sehr breit und nicht mode-/origin-spezifisch eingeschränkt. | `screens/PreviewFullscreenScreen.tsx:465` |
| F-04 | P2 | Stability/UX | Bei Prozessabbruch gibt es nur Error-Banner + manuellen Reload, kein gesteuerter Recovery-Flow. | `screens/PreviewFullscreenScreen.tsx:169-199`, `453-459` |
| F-05 | P3 | Performance/Maintainability | `handleNavigationStateChange` hat unnötige Dependencies (`mode`, `baseOrigin`) → vermeidbare Re-Creation. | `screens/PreviewFullscreenScreen.tsx:201-208` |
| F-06 | P2 | Tests/Coverage | Guard-Tests decken kritische Negativfälle nicht ab (baseOrigin=null in url-mode, riskante Schemes). | `__tests__/previewNavigationGuards.test.ts:1-65` |

---

## F-01 – Nicht-http(s)-Schemes werden zu breit direkt extern geöffnet

### Problem
`decidePreviewNavigation` behandelt **jede** nicht-http(s)-URL als `external_direct` (z. B. auch `intent://`, `file://`, `javascript:`, proprietäre Schemes). Danach wird im Screen direkt `Linking.openURL` aufgerufen. 

### Impact
- Unerwünschte OS-Deep-Link-Handoffs werden erleichtert.
- Verhalten variiert plattformabhängig und kann schwer reproduzierbare Sicherheits-/UX-Probleme erzeugen.
- Erhöhtes Risiko für Missbrauch über eingebettete Links in fremdem Content.

### Repro-Szenario
1. Preview lädt eine Seite mit Link auf `intent://...` oder `javascript:...`.
2. Guard liefert `external_direct`.
3. App versucht sofort `Linking.openURL(...)`.

### Empfehlung
- In `utils/previewNavigation.ts` eine **explizite Scheme-Allowlist** für `external_direct` einführen (z. B. `mailto:`, `tel:`, `sms:`).
- Für alle anderen nicht-http(s)-Schemes auf `block` oder mindestens `external_confirm` mit zusätzlicher Validierung wechseln.
- Optional Telemetrie/Logging für geblockte Schemes ergänzen (ohne sensible Daten).

## F-02 – Origin-Guard degradiert bei `baseOrigin === null`

### Problem
Im `url`-Mode greift Same-Origin-Prüfung nur, wenn `baseOrigin` gesetzt ist. Ist `baseOrigin` `null` (z. B. URL-Parsing scheitert), fällt die Logik auf `allow` zurück.

### Impact
- Sicherheitsinvariante „contain preview, external for cross-origin“ ist nicht mehr garantiert.
- Potenziell wird Navigation in fremde Origins innerhalb derselben WebView erlaubt.

### Repro-Szenario
1. Route enthält `url`, die `isHttpUrl` passiert, aber kein stabil parsebares `URL`-Objekt ergibt.
2. `baseOrigin` bleibt `null`.
3. http(s)-Navigation wird nicht abgegrenzt und kann intern passieren.

### Empfehlung
- In `decidePreviewNavigation`: wenn `mode === "url" && !baseOrigin`, dann **fail-closed** (`block` oder `external_confirm` für http(s)).
- Zusätzlich bereits vor Rendering von `WebView` stricter validieren (parsebarer URL-Check statt nur Regex).

## F-03 – `originWhitelist` aktuell zu breit

### Problem
`originWhitelist` erlaubt global `http://*`, `https://*`, `data:*`, `about:*`, `blob:*` – unabhängig von Mode/Origin.

### Impact
- Stärkeres Vertrauen in Runtime-Guard nötig; Defense-in-depth wird geschwächt.
- Bei Guard-Lücken/Regressionen ist Impact höher.

### Empfehlung
- Für `url`-Mode Whitelist auf primäre Origin + notwendige interne Schemes reduzieren.
- Für `html`-Mode http(s) möglichst nicht whitelisten, wenn externe Links ohnehin im Browser geöffnet werden sollen.
- Änderungen mit Plattformtests (iOS/Android) absichern, da WebView-Handling plattformabhängig ist.

## F-04 – Recovery bei Prozessabbruch nur manuell

### Problem
`onContentProcessDidTerminate` und `onRenderProcessGone` setzen Fehler + stoppen Loading, aber Recovery ist nur über manuelles „Neu laden“ möglich.

### Impact
- In instabilen Umgebungen bleibt die User Journey hängen (insb. White-Screen-/Crash-artige Verläufe).
- Nutzer müssen Ursache verstehen und selbst handeln.

### Empfehlung
- Optional „soft auto-reload once“ (einmalig, guardet gegen Loop) implementieren.
- Bei wiederholtem Prozessabbruch expliziten Fallback anbieten (z. B. „extern öffnen“ bei URL-Mode, „zurück zu PreviewScreen“).
- Error-Banner um klaren Status (z. B. „Prozess beendet / abgestürzt“) differenzieren.

## F-05 – Kleine Callback-Dependency-Irritation

### Problem
`handleNavigationStateChange` nutzt im Body nur `navState`, hat aber `[mode, baseOrigin]` als Dependencies.

### Impact
- Kein funktionaler Bug, aber unnötige Re-Kreation der Callback-Referenz.
- Erhöhte kognitive Last beim Lesen/Warten.

### Empfehlung
- Dependencies auf tatsächlich verwendete Werte reduzieren (hier vermutlich `[]` + stable setter usage ausreichend).

## F-06 – Testabdeckung bei Guards hat Lücken

### Problem
Vorhandene Tests decken Happy Paths und Basisfälle gut ab, aber kritische Negativ-/Hardening-Fälle fehlen.

### Impact
- Sicherheitsregressionen können unentdeckt bleiben.
- Verhalten bei Edge-Input bleibt undefiniert bzw. zufällig durch Plattform.

### Empfehlung
- Tests für `url`-Mode mit `baseOrigin=null` ergänzen (erwartetes fail-closed Verhalten).
- Tests für riskante Schemes (`intent://`, `file://`, `javascript:`) ergänzen.
- Test für Groß-/Kleinschreibung/Whitespace im URL-Input ergänzen.

---

## Quick Wins (max. 10)

1. Scheme-Allowlist für `external_direct` definieren und durchsetzen (`mailto`, `tel`, `sms`).
2. `url`-Mode ohne `baseOrigin` fail-closed machen.
3. URL-Validierung von Regex (`isHttpUrl`) auf robustes Parsing umstellen (mind. zusätzlich).
4. `originWhitelist` mode-spezifisch verengen.
5. Negativtests in `previewNavigationGuards.test.ts` für riskante Schemes ergänzen.
6. Testfall hinzufügen: `baseOrigin === null` im `url`-Mode.
7. Optional einmalige Auto-Recovery bei Prozessabbruch (mit Loop-Schutz).
8. Callback-Dependencies in Fullscreen screen säubern (kleiner Wartbarkeitsgewinn).

## Optional Improvements

- Zentralen „Security-Policy“-Helper für Preview-Navigation bauen (Schemes + Origin-Policy + Whitelist aus einer Quelle).
- Observability ergänzen: nicht-sensitive Zähler für geblockte/external Navigationsentscheidungen.
- UX: spezifischere Fehlermeldungen für Netzwerk/CSP/HTTP-Fehler inkl. aktionsorientierter CTA.

## Test Suggestions (echter Mehrwert)

1. **Guard-Fail-Closed-Test:** `mode=url`, `baseOrigin=null`, `requestUrl=https://example.com` → darf nicht `allow` sein.
2. **Scheme-Hardening-Test:** `intent://...`, `file://...`, `javascript:...` → block/confirm gemäß Policy.
3. **Normalization-Test:** URLs mit führenden/trailing spaces und gemischter Groß-/Kleinschreibung.
4. **Fullscreen-Flow-Test (Integration):** `external_confirm` löst keinen In-WebView-Navigationswechsel aus.
5. **Recovery-Test:** Prozessabbruch-Handler setzt Error-State konsistent und Reload räumt ihn wieder auf.


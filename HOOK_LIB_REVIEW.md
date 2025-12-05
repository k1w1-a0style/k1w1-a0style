# Kritische Prüfung: Hooks & Lib-Dateien

## Zusammenfassung
Datum: $(date)
Geprüfte Dateien: 5 Hooks, 17 Lib-Dateien

---

## 🔴 KRITISCHE PROBLEME

### 1. useBuildStatus.ts - Stale Ref-Wert im Return
**Zeile 225:** `errorCount: errorCountRef.current`
- **Problem:** Der Return-Wert wird nur einmal beim Rendern berechnet, nicht reaktiv aktualisiert
- **Impact:** Consumer sehen veraltete `errorCount` Werte
- **Fix:** Entweder State verwenden oder `errorCount` aus dem Return entfernen

### 2. useBuildStatusSupabase.ts - Fehlende Features
**Vergleich mit useBuildStatus.ts:**
- ❌ Kein Error-Counter (MAX_ERRORS)
- ❌ Kein Timeout-Handling
- ❌ Kein automatisches Stoppen bei finalen Status
- ❌ `isLoading` wird nicht richtig zurückgesetzt bei Fehlern
- **Impact:** Weniger robust als `useBuildStatus`, könnte zu endlosem Polling führen

### 3. useBuildTrigger.ts - Direkter Fetch statt Supabase Client
**Zeile 190:** Direkter `fetch()` statt `supabase.functions.invoke()`
- **Problem:** Umgeht die Supabase Client-Logik (Retry, Error-Handling)
- **Impact:** Inkonsistente Fehlerbehandlung
- **Fix:** Sollte `ensureSupabaseClient()` verwenden wie in anderen Hooks

### 4. useBuildTrigger.ts - Polling stoppt nicht bei finalen Status
**Zeile 104-123:** Polling stoppt nur bei `success`/`error`, nicht bei `failed`
- **Problem:** `failed` Status wird nicht als final erkannt
- **Impact:** Polling könnte weiterlaufen nach fehlgeschlagenem Build

### 5. useGitHubActionsLogs.ts - Unbenutzte Konstante
**Zeile 38:** `MAX_LOG_ENTRIES = 500` wird definiert aber nie verwendet
- **Problem:** Logs können unbegrenzt wachsen
- **Impact:** Memory-Leak bei langen Builds

### 6. orchestrator.ts - Doppeltes Timeout
**Zeile 552 & 668:** `withTimeout()` wird zweimal aufgerufen
- **Problem:** `callProviderWithRetry` hat bereits Timeout, wird nochmal gewrappt
- **Impact:** Unnötige Komplexität, könnte zu Race Conditions führen

### 7. orchestrator.ts - Kein echtes Abort
**Zeile 90:** `Promise.race` mit `setTimeout` ist kein echtes Abort
- **Problem:** Fetch-Request läuft weiter, nur Promise wird rejected
- **Impact:** Memory-Leaks, unnötige Netzwerk-Requests
- **Fix:** `AbortController` verwenden

### 8. SecureTokenManager.ts - Schwache Verschlüsselung
**Zeile 65-85:** XOR-Verschlüsselung statt AES-256
- **Problem:** XOR ist nicht sicher für Production
- **Impact:** Tokens können relativ einfach entschlüsselt werden
- **Fix:** `crypto-js` oder native AES-256 verwenden

### 9. SecureTokenManager.ts - Hardcoded Salt
**Zeile 23:** `SALT = 'k1w1-secure-token-v1'` ist hardcoded
- **Problem:** Salt sollte aus env kommen oder device-spezifisch sein
- **Impact:** Gleicher Salt für alle Devices = gleiche Keys

### 10. supabase.ts - Race Condition bei initPromise
**Zeile 40-42:** Mehrere gleichzeitige Calls könnten mehrere Promises erstellen
- **Problem:** `initPromise` wird auf `null` gesetzt bevor Client gesetzt ist
- **Impact:** Race Condition könnte zu mehreren Client-Instanzen führen

---

## ⚠️ MITTLERE PROBLEME

### 11. useBuildStatus.ts - Callbacks in Dependencies
**Zeile 190:** `callbacks` ist in `useCallback` Dependencies
- **Problem:** Callbacks werden bei jedem Render neu erstellt → `poll` wird neu erstellt
- **Impact:** Unnötige Re-Renders, Polling könnte neu gestartet werden
- **Fix:** `callbacks` mit `useRef` speichern

### 12. useGitHubActionsLogs.ts - Race Condition bei workflowStatusRef
**Zeile 139-175:** `workflowStatusRef` wird verwendet, aber Status könnte zwischen Updates stale sein
- **Problem:** Ref wird nur bei Status-Änderung aktualisiert, nicht bei jedem Poll
- **Impact:** Polling könnte nach finalem Status weiterlaufen

### 13. orchestrator.ts - Fehlende Error-Kategorisierung
**Zeile 148-165:** `shouldRotateKey()` erkennt nur einige Fehler-Typen
- **Problem:** Andere Fehler (z.B. 500 Server Errors) werden nicht rotiert
- **Impact:** Keys werden nicht rotiert bei temporären Server-Fehlern

### 14. fileWriter.ts - PROTECTED_FILES könnte größer sein
**Zeile 17-28:** Liste ist manuell gepflegt
- **Problem:** Könnte Dateien übersehen
- **Impact:** Wichtige Dateien könnten überschrieben werden

### 15. validators.ts - Zod Dependency
**Zeile 16:** Verwendet `zod` Library
- **Problem:** Muss in `package.json` vorhanden sein
- **Impact:** Build-Fehler wenn nicht installiert

---

## ✅ POSITIVE ASPEKTE

1. **Gute Error-Handling-Patterns** in `useBuildStatus.ts`
2. **Sichere Key-Verwaltung** mit `SecureKeyManager` (Closure-basiert)
3. **Umfassende Validierung** in `validators.ts`
4. **Gute Type-Safety** mit TypeScript und Type Guards
5. **Retry-Logik** mit Backoff in `retryWithBackoff.ts`
6. **Rate Limiting** implementiert
7. **Gute Kommentierung** in den meisten Dateien

---

## 🔧 EMPFOHLENE FIXES (Priorität)

### ✅ BEHOBEN (Hoch)
1. ✅ Fix `useBuildStatus.ts` errorCount Return - **BEHOBEN**: State hinzugefügt für reaktive Updates
2. ✅ Fix `orchestrator.ts` AbortController - **BEHOBEN**: AbortController implementiert für alle Provider-Calls
3. ✅ Fix `useBuildTrigger.ts` Supabase Client Usage - **BEHOBEN**: Verwendet jetzt `ensureSupabaseClient()`
4. ✅ Implementiere `MAX_LOG_ENTRIES` in `useGitHubActionsLogs.ts` - **BEHOBEN**: Logs werden jetzt begrenzt
5. ✅ Fix `useBuildTrigger.ts` Polling bei finalen Status - **BEHOBEN**: Erkennt jetzt auch `failed`/`failure`

### ⏳ AUSSTEHEND (Mittel)
6. Vereinheitliche `useBuildStatusSupabase.ts` mit `useBuildStatus.ts`
7. Verbessere `SecureTokenManager.ts` Verschlüsselung (XOR → AES-256)
8. Fix Race Condition in `supabase.ts` initPromise

### 📝 OPTIONAL (Niedrig)
9. Optimiere Callback-Dependencies in `useBuildStatus.ts`
10. Erweitere Error-Kategorisierung in `orchestrator.ts`
11. Dokumentiere PROTECTED_FILES besser

---

## 📊 STATISTIKEN

- **Gesamt-Dateien:** 22
- **Kritische Probleme:** 10 → **5 behoben** (5 verbleibend)
- **Mittlere Probleme:** 5
- **Code-Qualität:** 7/10 → **8/10** (nach Fixes)
- **Sicherheit:** 6/10 (wegen XOR-Verschlüsselung)
- **Performance:** 8/10 → **9/10** (AbortController verhindert Memory-Leaks)
- **Wartbarkeit:** 7/10 → **8/10**

## ✅ DURCHGEFÜHRTE FIXES

### useBuildStatus.ts
- ✅ `errorCount` wird jetzt als State verwaltet für reaktive Updates
- ✅ `setErrorCount()` wird bei jeder Änderung des Refs aufgerufen

### useBuildTrigger.ts
- ✅ Verwendet jetzt `ensureSupabaseClient()` statt direkten `fetch()`
- ✅ Polling stoppt jetzt auch bei `failed`/`failure` Status

### useGitHubActionsLogs.ts
- ✅ `MAX_LOG_ENTRIES` wird jetzt verwendet um Memory-Leaks zu verhindern
- ✅ Logs werden auf 500 Einträge begrenzt

### orchestrator.ts
- ✅ `AbortController` implementiert für alle Provider-Calls
- ✅ `withTimeout()` verwendet jetzt echtes Abort statt nur Promise.race
- ✅ Alle Provider-Funktionen unterstützen jetzt `AbortSignal`
- ✅ Fix: `callAnthropic` filtert jetzt korrekt `nonSystem` messages

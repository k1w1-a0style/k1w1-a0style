# ChatScreen Verification (Patch 63)

**Datum:** 2026-02-12  
**Scope:** ChatScreen + AI-Flow/Orchestrator + Storage/Settings (Privacy)

## 1) Review-Check: Was stimmt, was nicht?

### F-01 – Chat-History in Klartext persistiert
✅ Zutreffend: `contexts/projectStorage.ts` speichert das komplette `ProjectData` inkl. `chatHistory` in AsyncStorage.  
✅ Fix: Privacy-Setting eingeführt:
- **Settings → Privacy → Chat-Verlauf speichern**
- Wenn aus: `chatHistory` wird **nicht** persistiert (wird beim Save/Load geleert)
- Wenn an: `chatHistory` wird **gekürzt** (Retention Default: 200)

➡️ Betroffene Files:
- `lib/chatPrivacySettings.ts` (neu)
- `contexts/projectStorage.ts`
- `screens/SettingsScreen/components/PrivacySection.tsx` (neu)
- `screens/SettingsScreen/hooks/useSettingsScreen.ts`
- `screens/SettingsScreen/index.tsx`
- `screens/SettingsScreen/styles.ts`

### F-02 – Fehlende Request-Cancellation bei Unmount
✅ Zutreffend: laufende `runOrchestrator()` Requests konnten nach Unmount weiterlaufen und in State/History schreiben.  
✅ Fix: `AbortController` pro Request + Abort bei Unmount + Weitergabe des `signal` bis in `fetch()`.

➡️ Betroffene Files:
- `hooks/useChatAIFlow.ts`
- `lib/orchestrator.ts`

### F-03 – AutoFix-Queue überschreibt Requests
✅ Zutreffend: nur ein Slot (`queuedAutoFixRef`) → neue AutoFix überschreibt alte.  
✅ Fix: FIFO Queue (`string[]`) + `shift()` Drain; jedes AutoFix bekommt `seq` Meta.

➡️ Betroffene Files:
- `hooks/useChatAIFlow.ts`

### F-04 – Input-Verlust bei Request-Fehlern
✅ Zutreffend: Chat-Input wird vor dem Request geleert; bei Fehler weg.  
✅ Fix: Draft-Backup/Restore (Input + FileAsset) wenn `handleSendWithMeta()` **false** zurückgibt.

➡️ Betroffene Files:
- `hooks/useChatAIFlow.ts` (returns boolean)
- `screens/ChatScreen/hooks/useChatScreen.ts`

### F-05 – Parsing-Edgecases bei Objekt-Wrappern
✅ Zutreffend: Normalizer sucht nur JSON-Array-Fallback.  
✅ Fix: `extractJsonFallback()` kann **Array oder Object** aus Text/Fences extrahieren.

➡️ Betroffene Files:
- `lib/normalizer.ts`
- `lib/__tests__/normalizer.test.ts`

### F-06 – Referenzprüfung neuer Dateien zu eng
✅ Zutreffend: Referenzcheck nur gegen “incoming”, nicht gegen vorhandene Projektfiles.  
✅ Fix: `referenced` berücksichtigt jetzt **incoming OR existing**.

➡️ Betroffene Files:
- `lib/fileWriter.ts`

### F-07 – Schwache Typsicherheit in Kernpfaden
✅ Zutreffend: `any` in PendingChange/ConfigLike macht Bugs leichter.  
✅ Fix: harte Typen für Provider/Quality + `OrchestratorResult` in PendingChange.

➡️ Betroffene Files:
- `hooks/useChatAIFlow.ts`

### F-08 – Hohe Komplexität in useChatAIFlow
⚠️ Zutreffend als Tech-Debt: Datei ist groß & macht viel.  
✅ Im Patch 63: kleine Entkopplung (Queue-Runner via Ref), weniger `any`, klarere Return-Values.  
➡️ Größere Split-Refactor (z.B. `useBuilderFlow`, `usePlannerFlow`, `useAutoFixQueue`) bleibt optional für später.

## 2) Ändert das die Screen-Optik?

**Nein – Layout/Design bleibt gleich.**  
Was sich ändert ist Verhalten:
- Kein “Zombie-Request” mehr beim Navigieren/Unmount (Abbruch statt Ghost-Update).
- AutoFix arbeitet sauber FIFO ab (kein Überschreiben).
- Chat-Draft bleibt bei Fehlern erhalten.
- Optional: neuer Settings-Block **Privacy** (neue UI im Settings-Screen, nicht im Chat-Screen).
- Parsing/Referenzen/Typen sind reine Stabilitäts-Fixes.

## 3) Patch 63 – Umsetzung (kurz)

- ✅ AbortController: Orchestrator + fetch() abort-fähig  
- ✅ Draft Restore bei Fehler/Abort  
- ✅ AutoFix FIFO Queue  
- ✅ Privacy Toggle + Retention  
- ✅ Normalizer robust gegen Objekt-Wrapper/Fences  
- ✅ Referenzcheck erweitert  
- ✅ Tests ergänzt (Normalizer)



## Patch 64 follow-up
- Fixed typecheck issues found after applying Patch 63 (meta.seq, boolean returns, FileWriter helper boundaries, orchestrator abort scope).


## Patch 65 follow-up
- Fixed orchestrator parse error (missing brace) and hardened runOrchestrator return paths (abort/error always returns a valid result).


## Patch 65 hotfix
- Fixed orchestrator parse error (missing closing brace) that blocked typecheck/lint/tests.
- Made runOrchestrator abort/error paths always return provider+timing.


## Patch 66 follow-up
- Fixed orchestrator TS scope errors (`resolvedModel`, `keysRotated`) by moving them to outer scope so abort/error return paths compile.


## Patch 102 hotfix (Legacy Chat-Verlauf sichtbar)
Problem: alte Speicherstände konnten Chat-Einträge ohne `id` enthalten (früher nicht benötigt).  
Seitdem ChatScreen/Context strikt nach `msg.id` filtern, wurde der Verlauf dadurch **leer angezeigt**.

Fix:
- Storage-Migration ergänzt: `loadProjectFromStorage()` ergänzt fehlende `id`/`timestamp` (UUID + now).
- ProjectContext liefert Messages tolerant aus (fallback `timestamp`).
- ChatScreen `keyExtractor` nutzt `id || timestamp || index`.

➡️ Betroffene Files:
- `contexts/projectStorage.ts`
- `contexts/ProjectContext.tsx`
- `screens/ChatScreen/index.tsx`
- Tests: `__tests__/chatHistoryMigration.test.ts`


## Patch 103 hotfix (Chatverlauf wurde trotzdem leer, wenn Retention-Key fehlte)
Root cause: `getChatHistoryRetentionLimit()` hat bei fehlendem AsyncStorage-Key `null` gelesen.
`Number(null) === 0` → Retention wurde **0** → `trimChatHistory()` hat konsequent alles gelöscht.

Fix:
- `getChatHistoryRetentionLimit()` behandelt `null` / "" als **DEFAULT_RETENTION (200)**.
- Damit bleiben bestehende Chat-Historien standardmäßig erhalten (so wie vorgesehen).

➡️ Betroffene Files:
- `lib/chatPrivacySettings.ts`


## Patch 104 (ChatScreen Hardening & UX/Perf)

Ziel: kritisches Review-Follow-up (Race/Queue/Scroll/Modal/UX) ohne Keyboard-/iOS-Refactor.

Änderungen:
- **AI-Flow Race-Fix**: `processAIRequest` liest `messages` / `projectFiles` / `pendingPlan` aus Refs statt aus potenziell stale Closures (wichtig bei AutoFix-Queue via `processAIRequestRef.current`).
- **AutoFix Queue bounded**: Queue-Limit (Default: 5) + Drop-Warnung, um Endlosschleifen/RAM-Spikes zu vermeiden.
- **Scroll entkoppelt**: `hardScrollToBottom` ist debounced und macht genau **einen** Retry nach 150ms (Retry ohne Animation; Timer wird bei Unmount und vor neuem Call gecleart).
- **ConfirmChangesModal robust**: Summary ist scrollbar und wird ab 15k Zeichen gekürzt („… (Text gekürzt)“), um UI-Lag durch oversized LLM-Output zu verhindern.
- **Destructive Actions**: Bestätigungs-Dialoge vor „Chat leeren“ / „Neues Projekt“.
- **Scroll/Keyboard UX**: `TouchableWithoutFeedback`-Wrapper entfernt, Keyboard-Dismiss läuft über FlatList (reduziert Scroll-Gesture-Probleme auf Android).
- **Typ-Konsistenz**: `MessageItem` nutzt den zentralen `ChatMessage`-Typ (keine lokale Drift).

➡️ Betroffene Files (Auszug):
- `hooks/useChatAIFlow.ts`
- `screens/ChatScreen/hooks/useChatScreen.ts`
- `screens/ChatScreen/index.tsx`
- `components/chat/ConfirmChangesModal.tsx`
- `components/ChatHeaderActions.tsx`
- `components/MessageItem.tsx`


# SYSTEM_README.md
# 🔥 KI-Optimierte System-Dokumentation für Cursor
Diese Datei ist das **Masterdokument**, das die Cursor-KI benötigt, um dein Projekt vollständig zu verstehen.  
Sie erweitert die große ursprüngliche README (»README (1).md«) und ergänzt alles, was wir neu besprochen haben.

---

# 1. 📌 Projektübersicht
**k1w1-a0style** ist ein mobiler App-Builder ähnlich Bolt / Lovable, aber vollständig in React Native mit Expo SDK 54 entwickelt.  
Die App kann:

- komplette RN-Projekte bearbeiten  
- KI-basiert Code generieren  
- EAS Builds auslösen  
- Projekte analysieren  
- ZIP Import/Export durchführen  
- GitHub-Repos verwalten  
- Logs & Diagnose anzeigen  

Dieses Dokument ermöglicht der KI:

- Abhängigkeiten zu verstehen  
- Modulverhalten korrekt einzuschätzen  
- Fehlerquellen zu erkennen  
- Build-Prozesse richtig auszuführen  
- neue Funktionen kompatibel zu implementieren  

---

# 2. 🧱 Architekturübersicht
Die App besteht aus:

- `screens/` (11 Screens)
- `components/` (11 UI-Modules)
- `lib/` (Core-Logic, 15 Modules)
- `contexts/` (7 Modules: AIContext, GitHubContext, githubService, ProjectContext, projectStorage, TerminalContext, types)
- `supabase/functions/` (7 Edge Functions)
- `hooks/` (5 Hooks: useBuildStatus, useBuildStatusSupabase, useBuildTrigger, useGitHubActionsLogs, useGitHubRepos)
- `utils/` (4 Modules: chatUtils, metaCommands, projectSnapshot, syntaxValidator)
- `templates/`
- `types/`
- `__tests__/` + `__mocks__/`

Die KI MUSS diese Module kennen, da sie miteinander interagieren.

---

# 3. 🧩 Wichtige Kernmodule

## 3.1 Orchestrator (`lib/orchestrator.ts`)
- Hauptmodul für Provider-Routing  
- Unterstützt: Groq, Gemini, OpenAI, Anthropic, HuggingFace  
- Implementiert Fallback-Strategien  
- Nutzt SecureKeyManager  

### KI-Regeln:
- immer `orchestrator.ask()` verwenden  
- niemals direkt Provider ansprechen  
- Keys niemals manuell setzen → SecureKeyManager benutzen  

---

## 3.2 SecureKeyManager / SecureTokenManager
- verwaltet API Keys
- verschlüsselt sie lokal
- rotiert Keys automatisch
- verhindert Rate Limit Errors

### KI-Regel:
```ts
import SecureKeyManager from '../lib/SecureKeyManager'
```
→ niemals Keys hardcoden.

---

## 3.3 Project Analyzer
Analysiert geladene Projekte:

- prüft `app.config.js`
- prüft Android packageName
- prüft `App.tsx` Existenz
- erkennt Expo SDK Version
- listet Probleme im DiagnosticScreen

### KI-Regel:
Wenn Projektdateien generiert werden → IMMER gültige Struktur sicherstellen.

---

# 4. 📝 System-Regeln für Cursor KI
### 4.1 Dateien nur ändern, wenn:
- sie im Kontext existieren  
- der Pfad korrekt ist  
- sie syntaktisch valide bleiben  

### 4.2 Beim Erstellen neuer Dateien:
- Pfade IMMER relativ zu `/`  
- TS statt JS bevorzugen  
- Expo-RN kompatibel halten  

### 4.3 Keine nativen Module einbauen (RN → Expo Managed Workflow)

### 4.4 KI DARF:
- neue Screens anlegen  
- Komponenten erweitern  
- Validatoren ergänzen  
- Supabase Functions erweitern  

### KI DARF NICHT:
- native Android/iOS Module hinzufügen  
- Expo Managed Workflow verlassen  
- Dateien außerhalb des Projektbaums referenzieren  

---

# 5. 📱 Screens (mit Korrekturen & Änderungen)

### ⚠️ HINWEIS: PreviewScreen
❗ Der "PreviewScreen" ist KEIN echtes Preview → sollte zu **AppStatusScreen** umbenannt werden.  
**Status:** Noch nicht umgesetzt. Datei heißt noch `PreviewScreen.tsx`.

Ein echter PreviewScreen (Bolt-Style) wird in Zukunft implementiert.

### 📋 Alle Screens:
| Screen | Funktion |
|--------|----------|
| ChatScreen | KI-Chat |
| CodeScreen | Editor |
| PreviewScreen | Projektinfos, Analyse (sollte AppStatusScreen heißen) |
| BuildScreen | Build-Status |
| EnhancedBuildScreen | Detaillierte Build-Logs |
| TerminalScreen | Terminal-Logs |
| SettingsScreen | API Keys |
| ConnectionsScreen | GitHub/Expo Verbindungen |
| GitHubReposScreen | Repository-Verwaltung |
| AppInfoScreen | Icons, Backup |
| DiagnosticScreen | Fehleranalyse |

---

# 6. 🛠️ ZIP Import/Export (Aktueller Stand)
- ZIP-Export funktioniert  
- ZIP-Import → **fehlt** (ToDo HIGH PRIORITY)

Importprozess soll:

1. ZIP entpacken  
2. strikte Validierung über Project Analyzer  
3. Datei-Struktur in FileTree laden  
4. Projektzustand in ProjectContext setzen  

---

# 7. 🔗 GitHub Repo Funktionen
Aktuell fehlen (ToDo HIGH):

- Repo löschen  
- Repo neu erstellen  
- Pull  
- Push (teilweise bereits vorhanden, aber unvollständig)

KI darf diese Features implementieren.

---

# 8. 🪲 Bekannte Bugs (MÜSSEN berücksichtigt werden)

### 8.1 ChatScreen Input-Bug
- Eingabefeld hängt in der Mitte  
- Wird komplett von der Tastatur verdeckt  

### KI-Pflicht:
→ Immer `KeyboardAvoidingView` + `useSafeAreaInsets()` berücksichtigen.

---

### 8.2 DiagnosticScreen Fix-Bug
Problem:
- Klick auf "Fix" erzeugt Nachricht  
- KI antwortet NICHT automatisch  
- Benutzer muss Nachricht manuell kopieren

KI-Pflicht:
→ Fix-Requests sollen direkt an KI gehen und Response soll direkt verarbeitet werden.

---

### 8.3 Nachrichten-Ränder abgeschnitten
→ Layout-Bug im MessageItem.

---

# 9. 📋 Vollständige ToDo-Liste (Neu strukturiert + Prioritäten)

**Stand:** 9. Dezember 2025  
**Tests:** 113 passed, 7 Suites  
**Coverage:** ~10-15% (Ziel: 40%)

## 🔥 HIGH PRIORITY
- [ ] ZIP-Import implementieren  
- [ ] ChatScreen Input fixen (Keyboard + Position)  
- [ ] DiagnosticScreen Auto-Fix (KI soll automatisch reagieren)  
- [ ] GitHub Funktionen erweitern (Delete, Create, Pull, Push)  
- [ ] Echten PreviewScreen bauen (Bolt-Style)  
- [ ] PreviewScreen → AppStatusScreen umbenennen  
- [ ] Project Analyzer verbessern  
- [ ] Test Coverage auf 40% erhöhen  

## 🟡 MEDIUM
- [ ] Integration Tests (AI + Orchestrator)  
- [ ] SEC-005: Memory Leaks fixen  
- [ ] SEC-006: Rate Limiting verbessern  
- [ ] fileWriter.test.ts erstellen  
- [ ] SecureTokenManager.test.ts erstellen  
- [ ] coverage/ Ordner aus Git entfernen (.gitignore aktualisieren)  
- [ ] Mehrere Diagnose-Fixes gleichzeitig ausführen  

## 🟢 LOW
- [ ] Build-Historie implementieren  
- [ ] Mehr Templates hinzufügen  
- [ ] Push-Benachrichtigungen nach Build  
- [ ] Chat Syntax Highlighting  
- [ ] E2E Tests mit Detox  
- [ ] SEC-007 bis SEC-011 Security Issues  

---

# 10. 🧪 Tests
**Status:** 113 Tests passed, 7 Test Suites (3 Tests skipped)  
**Coverage:** ~10-15%

### Vorhandene Test-Dateien:
- `__tests__/App.test.tsx`
- `__tests__/smoke.test.ts`
- `__tests__/chatParsing.test.ts`
- `__tests__/navigation.smoke.test.tsx`
- `__tests__/jsonTruncation.test.ts`
- `lib/__tests__/SecureKeyManager.test.ts`
- `lib/__tests__/validators.test.ts`

### Fehlende Tests (TODO):
- [ ] `lib/__tests__/fileWriter.test.ts`
- [ ] `lib/__tests__/orchestrator.test.ts` erweitern
- [ ] `lib/__tests__/SecureTokenManager.test.ts`
- [ ] Integration Tests für AI-Context  

---

# 11. 🧱 Build Informationen
Expo Managed Workflow  
EAS nutzt:

- `development`
- `preview`
- `production`

Android Backup enthält Referenzen, NICHT produktiv nutzen.

---

# 12. ⚙️ Pflichtdateien für ein gültiges Projekt
Die KI MUSS IMMER sicherstellen:

### `App.tsx` existiert  
### `app.config.js` existiert  

Ohne diese → Projekt **ungültig**.

---

# 13. 🧩 KI-Arbeitsrichtlinien für dieses Projekt
Damit Cursor perfekte Ergebnisse liefert:

- IMMER TypeScript verwenden  
- IMMER relative Imports  
- Expo-Kompatibilität beachten  
- Dateien niemals "geraten" → IMMER prüfen, ob sie existieren  
- KI soll strukturierten, kommentierten Code erzeugen  

---

# 14. 📚 Supabase Functions (7 Stück)
Die KI darf diese erweitern, aber:

- keine Breaking Changes  
- Input/Output strikt definieren  
- Logs sauber halten  

---

# 15. 🎉 Schlusswort
Dies ist die vollständige System-Dokumentation für Cursor.  
Alle Module, Bugs, Features und Logiken sind enthalten.

KI kann ab jetzt:

- Code korrekt generieren  
- Fehler richtig interpretieren  
- neue Features kompatibel entwickeln  

ENDE.

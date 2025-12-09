
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

### ✅ AppStatusScreen (ehemals PreviewScreen)
PreviewScreen wurde zu **AppStatusScreen** umbenannt.  
**Status:** ✅ Umgesetzt (9. Dezember 2025)

Ein echter PreviewScreen (Bolt-Style Live-Preview) wird in Zukunft implementiert.

### 📋 Alle Screens:
| Screen | Funktion |
|--------|----------|
| ChatScreen | KI-Chat (mit Auto-Fix Support) |
| CodeScreen | Editor |
| AppStatusScreen | Projektinfos, Build-Validierung ✅ |
| BuildScreen | Build-Status |
| EnhancedBuildScreen | Detaillierte Build-Logs |
| TerminalScreen | Terminal-Logs |
| SettingsScreen | API Keys |
| ConnectionsScreen | GitHub/Expo Verbindungen |
| GitHubReposScreen | Repository-Verwaltung (Create/Delete/Push/Pull) |
| AppInfoScreen | Icons, Backup |
| DiagnosticScreen | Fehleranalyse (mit Auto-Fix) |

---

# 6. 🛠️ ZIP Import/Export (Aktueller Stand)
- ZIP-Export ✅ funktioniert  
- ZIP-Import ✅ funktioniert (implementiert in projectStorage.ts)

Importprozess:

1. ZIP entpacken via react-native-zip-archive
2. strikte Validierung über validators.ts (validateZipImport)
3. Datei-Struktur in FileTree laden  
4. Projektzustand in ProjectContext setzen  

---

# 7. 🔗 GitHub Repo Funktionen
✅ Alle Funktionen implementiert:

- **Repo erstellen** ✅ (createRepo in githubService.ts)
- **Repo löschen** ✅ (deleteRepo in useGitHubRepos.ts)
- **Repo umbenennen** ✅ (renameRepo in useGitHubRepos.ts)
- **Pull** ✅ (pullFromRepo in useGitHubRepos.ts)
- **Push** ✅ (pushFilesToRepo in githubService.ts)

UI: GitHubReposScreen.tsx enthält alle Funktionen.

---

# 8. 🪲 Bekannte Bugs (MÜSSEN berücksichtigt werden)

### 8.1 ChatScreen Input-Bug ✅ BEHOBEN
- ~~Eingabefeld hängt in der Mitte~~  
- ~~Wird komplett von der Tastatur verdeckt~~
- **Fix:** KeyboardAvoidingView behavior='height' für Android, keyboardVerticalOffset für iOS

### KI-Pflicht:
→ Immer `KeyboardAvoidingView` + `useSafeAreaInsets()` berücksichtigen.

---

### 8.2 DiagnosticScreen Fix-Bug ✅ BEHOBEN
~~Problem:~~
- ~~Klick auf "Fix" erzeugt Nachricht~~  
- ~~KI antwortet NICHT automatisch~~  
- ~~Benutzer muss Nachricht manuell kopieren~~

**Fix:** Auto-Fix Feature implementiert:
- triggerAutoFix() im ProjectContext
- ChatScreen hört auf autoFixRequest und startet KI-Flow automatisch

---

### 8.3 Nachrichten-Ränder abgeschnitten
→ Layout-Bug im MessageItem (OFFEN).

---

# 9. 📋 Vollständige ToDo-Liste (Neu strukturiert + Prioritäten)

**Stand:** 9. Dezember 2025  
**Tests:** 162 passed, 9 Suites  
**Coverage:** ~15-20% (Ziel: 40%)

## ✅ COMPLETED (9. Dezember 2025)
- [x] ZIP-Import implementieren  
- [x] ChatScreen Input fixen (Keyboard + Position)  
- [x] DiagnosticScreen Auto-Fix (KI soll automatisch reagieren)  
- [x] GitHub Funktionen erweitern (Delete, Create, Pull, Push)  
- [x] PreviewScreen → AppStatusScreen umbenennen  
- [x] fileWriter.test.ts erstellen  
- [x] SecureTokenManager.test.ts erstellen  
- [x] coverage/ Ordner aus Git entfernen (.gitignore aktualisieren)  

## 🔥 HIGH PRIORITY
- [ ] Echten PreviewScreen bauen (Bolt-Style Live-Preview)  
- [ ] Project Analyzer verbessern  
- [ ] Test Coverage auf 40% erhöhen  

## 🟡 MEDIUM
- [ ] Integration Tests (AI + Orchestrator)  
- [ ] SEC-005: Memory Leaks fixen  
- [ ] SEC-006: Rate Limiting verbessern  
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
**Status:** 162 Tests passed, 9 Test Suites (3 Tests skipped)  
**Coverage:** ~15-20%

### Vorhandene Test-Dateien:
- `__tests__/App.test.tsx`
- `__tests__/smoke.test.ts`
- `__tests__/chatParsing.test.ts`
- `__tests__/navigation.smoke.test.tsx`
- `__tests__/jsonTruncation.test.ts`
- `lib/__tests__/SecureKeyManager.test.ts`
- `lib/__tests__/validators.test.ts`
- `lib/__tests__/fileWriter.test.ts` ✅ NEU
- `lib/__tests__/SecureTokenManager.test.ts` ✅ NEU

### Fehlende Tests (TODO):
- [ ] `lib/__tests__/orchestrator.test.ts` erweitern
- [ ] Integration Tests für AI-Context
- [ ] E2E Tests mit Detox  

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

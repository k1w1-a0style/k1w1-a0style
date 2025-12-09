
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
- `contexts/` (App State Layers)
- `supabase/` (7 Edge Functions)
- `hooks/`
- `utils/`
- `templates/`
- `android_backup/`
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

### 🟢 NEU / GEÄNDERT
❗ Der "PreviewScreen" ist KEIN Preview → **umbenannt zu AppStatusScreen**.

Ein echter PreviewScreen (Bolt-Style) wird in Zukunft implementiert.

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

## 🔥 HIGH PRIORITY
- ZIP-Import implementieren  
- ChatScreen Input fixen  
- DiagnosticScreen Auto-Fix  
- GitHub Funktionen erweitern  
- echten PreviewScreen bauen  
- project analyzer verbessern  

## 🟡 MEDIUM
- Integration Tests  
- Memory Leaks fixen  
- Rate Limiting verbessern  
- Coverage erhöhen  
- mehrere Diagnose-Fixes gleichzeitig  

## 🟢 LOW
- Build-Historie  
- mehr Templates  
- Push-Benachrichtigungen  
- Chat Syntax Highlighting  

---

# 10. 🧪 Tests
113 Tests vorhanden.  
Neue Tests notwendig:

- fileWriter.test.ts  
- orchestrator Erweiterung  
- SecureTokenManager  

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

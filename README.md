# k1w1-a0style 🚀
**React Native App-Builder mit KI-Integration (Bolt-Style)**

Erstellen, Bearbeiten und Bauen von React-Native-Apps direkt auf dem Handy – mit KI-Unterstützung, GitHub-Anbindung und EAS-Builds.

---

## 📊 Projekt-Status
| Bereich | Status |
|--------|--------|
| Security | 7/11 behoben |
| Tests | 113 Tests, 7/7 Suites |
| EAS Build | Vollständig konfiguriert |
| UX | Stabil, modern |
| Version | **BETA-READY** |

---

## ✨ Features
### 🤖 KI
- Multi-Provider (Groq, OpenAI, Gemini, Anthropic, HF)  
- Fallback, Key-Rotation, Speed/Quality-Modi

### 🗂️ Projekt
- Datei-Editor  
- Dateioperationen  
- ZIP-Export ✔️  
- ZIP-Import ⚠️ In Arbeit  
- Syntax-Validierung

### 🔗 GitHub
- Repos anzeigen  
- Workflow-Trigger  
- Logs anzeigen  
- **Fehlend (und im To-Do):** Delete, Create Repo, Pull, Push

### 🏗️ Build
- EAS Trigger  
- Build-Status  
- Fehleranalyse  
- APK/AAB Download

---

## 🧱 Architektur
- `screens/`, `components/`, `hooks/`, `contexts/`
- `lib/` → Core-Logic  
- **Project Analyzer** prüft Projektdateien  
- **BuildConfig Reader** liest SDK, Versionen usw.

---

## 🛠️ Pflichtdateien
Diese Dateien **müssen existieren**, damit dein Projekt gültig ist:

### **App.tsx**
- Einstiegspunkt  
- Muss im Projekt vorhanden sein

### **app.config.js**
- Definiert Name, Slug, Android-Package  
- Ohne diese Datei → Analyzer-Fehler

Beispiel:
```js
module.exports = {
  expo: {
    name: "MyApp",
    slug: "myapp",
    android: { package: "com.example.myapp" }
  }
}
```

---

# ⚙️ ZIP Import & Export
### ZIP-Export  
✔️ Vorhanden und funktionsfähig

### ZIP-Import  
⚠️ Noch nicht implementiert  
→ Steht in To-Do (Priorität Hoch)

---

# 📱 Screens
| Screen | Funktion |
|--------|----------|
| ChatScreen | KI-Chat |
| CodeScreen | Editor |
| **App-Status (ehemals Preview)** | Projektinfos, Analyse |
| BuildScreen | Build-Status |
| EnhancedBuildScreen | Logs |
| TerminalScreen | Logs |
| SettingsScreen | API Keys |
| ConnectionsScreen | GitHub/Expo |
| GitHubReposScreen | Repos |
| AppInfoScreen | Icons, Backup |
| DiagnosticScreen | Fehleranalyse |

---

# ❗ Bekannte Probleme
- Chat-Eingabefeld hängt mittig & wird verdeckt  
- Diagnose-Fix wird nicht automatisch verarbeitet  
- Nachrichten im Chat werden abgeschnitten  
- ZIP-Import fehlt  
- GitHub Repo-Funktionen unvollständig  
- Irreführender Preview-Name → ersetzt durch **App-Status**

---

# 📋 To-Do Liste (Screenshots integriert, logisch sortiert)

## ✅ Erledigt
- Security: KeyManager, Zod Validation, Encryption, Mutex  
- Tests: 113 Stück, Mocks komplett  
- Build: EAS konfiguriert, EnhancedBuildScreen  
- UI: Terminal, Chat-Optimierungen, AppInfoScreen  
- Hooks: useBuildStatus, useGitHubActionsLogs  
- Docs: README aktualisiert  
- .gitignore Fix  

---

## 🔥 Priorität: Hoch
- Test Coverage erhöhen (40%)  
- fileWriter.test.ts  
- orchestrator.test.ts erweitern  
- Web-Favicon fixen (`app.config.js → web.favicon`)  
- **ZIP-Import implementieren**  
- **GitHub Repo Screen erweitern** (Delete, Create, Pull, Push)  
- **DiagnosticScreen Fix-Button reparieren**  
- **Chat-Input fixen** (Position + Keyboard)  
- **Preview-Screen umbenennen** → „App-Status“  
- **Echten Preview-Screen planen**

---

## 🟡 Priorität: Mittel
- CI/CD für Tests  
- Integration Tests (AI + Orchestrator)  
- SEC-005: Memory Leaks  
- SEC-006: Rate Limiting  
- SecureTokenManager.test.ts  
- coverage/ aus Repo entfernen  
- ChatScreen Layout fixen  
- Mehrere Diagnose-Fixes gleichzeitig ausführen  

---

## 🟢 Priorität: Niedrig
- E2E Tests (Detox)  
- SEC-007 bis SEC-011  
- Push-Benachrichtigungen nach Build  
- Build-Historie  
- Syntax-Highlighting im Chat  
- Weitere Templates  
- Optional: Auto-Next-Step-Assistent  

---

## 📋 Security-Issues (aus Screenshot)
| Issue | Beschreibung | Priorität |
|-------|--------------|-----------|
| SEC-005 | Memory Leaks | Mittel |
| SEC-006 | Rate Limiting | Mittel |
| SEC-007 | XSS Prevention | Niedrig |
| SEC-008 | Supabase RLS | Niedrig |
| SEC-009 | CORS Hardening | Niedrig |
| SEC-010 | Dependency Audit | Mittel |
| SEC-011 | Supabase Function Validation | Niedrig |

---

# 🛠️ Development
```bash
npm install
npm start
npm run test
```

---

Fertig. Repo-ready. 💚🚀

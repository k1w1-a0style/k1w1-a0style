# k1w1-a0style 🚀
**React Native App-Builder mit KI-Integration (Bolt-Style)**

Erstellen, Bearbeiten und Bauen von React-Native-Apps direkt auf dem Handy – mit KI-Unterstützung, GitHub-Anbindung und EAS-Builds.

---

## 📊 Projekt-Status
| Bereich | Status |
|--------|--------|
| Security | 10/11 behoben (SEC-005 bis SEC-011) |
| Tests | 330 passed, 17 Suites (~40% Coverage) ✅ |
| EAS Build | Vollständig konfiguriert |
| UX | Stabil, modern |
| Version | **BETA-READY** |

**Letzte Aktualisierung:** 9. Dezember 2025

---

## ✨ Features
### 🤖 KI
- Multi-Provider (Groq, OpenAI, Gemini, Anthropic, HF)
- Fallback, Key-Rotation, Speed/Quality-Modi

### 🗂️ Projekt
- Datei-Editor
- Dateioperationen
- ZIP-Export ✔️
- ZIP-Import ✔️ (vollständig implementiert)
- Syntax-Validierung

### 🔗 GitHub
- Repos anzeigen ✔️
- Repos erstellen ✔️
- Repos löschen ✔️
- Repos umbenennen ✔️
- Workflow-Trigger ✔️
- Logs anzeigen ✔️
- Pull/Push ✔️

### 🏗️ Build
- EAS Trigger
- Build-Status
- Fehleranalyse
- APK/AAB Download

---

## 🧱 Architektur
- `screens/` (12 Screens: ChatScreen, CodeScreen, TerminalScreen, SettingsScreen, ConnectionsScreen, GitHubReposScreen, DiagnosticScreen, AppStatusScreen, PreviewScreen, BuildScreen, EnhancedBuildScreen, AppInfoScreen)
- `components/` (11 UI-Modules)
- `lib/` (15 Core-Logic Modules)
- `contexts/` (7 State Modules)
- `hooks/` (6 Custom Hooks: useBuildStatus, useBuildStatusSupabase, useBuildTrigger, useGitHubActionsLogs, useGitHubRepos, useNotifications)
- `utils/` (4 Utility Modules)
- `supabase/functions/` (7 Edge Functions)
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
✔️ Vollständig implementiert (9. Dezember 2025)
- Implementiert in `contexts/projectStorage.ts`
- Validierung über `lib/validators.ts` (validateZipImport)
- Unterstützt rekursives Entpacken
- Sicherheitsprüfungen (Pfad-Validierung, Content-Validierung, Größenlimits)

---

# 📱 Screens
| Screen | Funktion |
|--------|----------|
| ChatScreen | KI-Chat (mit Auto-Fix Support, Syntax Highlighting) |
| CodeScreen | Editor |
| AppStatusScreen | Projektinfos, Build-Validierung ✅ (ehemals PreviewScreen) |
| PreviewScreen | Live-Preview (Bolt-Style) ✅ NEU |
| BuildScreen | Build-Status (Re-export von EnhancedBuildScreen) |
| EnhancedBuildScreen | Detaillierte Build-Logs (mit Notifications, Build-Historie) |
| TerminalScreen | Terminal-Logs |
| SettingsScreen | API Keys + Notifications-Einstellungen |
| ConnectionsScreen | GitHub/Expo Verbindungen |
| GitHubReposScreen | Repository-Verwaltung (Create/Delete/Push/Pull) ✅ |
| AppInfoScreen | Icons, Backup |
| DiagnosticScreen | Fehleranalyse (mit Auto-Fix, Multi-Fix) |

---

# ❗ Bekannte Probleme
✅ Alle kritischen Bugs behoben (9. Dezember 2025):
- ✅ Chat-Eingabefeld fix (KeyboardAvoidingView + dynamische Höhe)
- ✅ Diagnose-Fix Auto-Verarbeitung implementiert
- ✅ Nachrichten-Ränder behoben (Layout-Verbesserungen)
- ✅ ZIP-Import vollständig implementiert
- ✅ GitHub Repo-Funktionen vollständig (Create/Delete/Pull/Push)
- ✅ PreviewScreen → AppStatusScreen umbenannt + neuer PreviewScreen implementiert

**Offene Punkte:**
- [ ] E2E Tests mit Detox
- [ ] SEC-008: Supabase RLS (Datenbank-Konfiguration)

---

# 📋 To-Do Liste (logisch sortiert)

## ✅ Erledigt (Stand: 9. Dezember 2025)
- Security: KeyManager, Zod Validation, Encryption, Mutex
- Tests: 330 Tests (17 Suites), ~40% Coverage ✅
- Build: EAS konfiguriert, EnhancedBuildScreen mit Build-Historie
- UI: Terminal, Chat-Optimierungen, AppInfoScreen, PreviewScreen
- Hooks: useBuildStatus, useBuildStatusSupabase, useBuildTrigger, useGitHubActionsLogs, useGitHubRepos, useNotifications ✅
- ZIP-Import: Vollständig implementiert ✅
- GitHub Repo-Funktionen: Create/Delete/Pull/Push vollständig ✅
- PreviewScreen: Umbenennung zu AppStatusScreen + neuer Live-PreviewScreen ✅
- Push-Benachrichtigungen: Vollständig implementiert ✅
- Chat Syntax Highlighting: Implementiert ✅
- Security: SEC-005 bis SEC-011 behoben (10/11) ✅
- Docs: README aktualisiert
- .gitignore Fix

---

## 🔥 Priorität: Hoch
- [x] Test Coverage erhöhen (Ziel: 40%, erreicht: ~40%) ✅
- [x] fileWriter.test.ts erstellen ✅
- [x] orchestrator.test.ts erweitern ✅
- [ ] Web-Favicon fixen (`app.config.js → web.favicon`)
- [x] **ZIP-Import implementieren** ✅
- [x] **GitHub Repo Screen erweitern** (Delete, Create, Pull, Push) ✅
- [x] **DiagnosticScreen Fix-Button reparieren** (Auto-KI-Antwort) ✅
- [x] **Chat-Input fixen** (Position + Keyboard) ✅
- [x] **PreviewScreen.tsx umbenennen** → „AppStatusScreen.tsx" ✅
- [x] **Echten Preview-Screen planen** (Bolt-Style) ✅

---

## 🟡 Priorität: Mittel
- [ ] CI/CD für Tests
- [x] Integration Tests (AI + Orchestrator) ✅ (AIContext.integration.test.ts vorhanden)
- [x] SEC-005: Memory Leaks ✅ (Code Review durchgeführt, keine kritischen Leaks)
- [x] SEC-006: Rate Limiting ✅ (TokenBucketRateLimiter implementiert)
- [x] SecureTokenManager.test.ts erstellen ✅
- [x] coverage/ aus Repo entfernen ✅
- [x] ChatScreen Layout fixen ✅
- [x] Mehrere Diagnose-Fixes gleichzeitig ausführen ✅ (Multi-Fix Button)

---

## 🟢 Priorität: Niedrig
- [ ] E2E Tests (Detox)
- [x] SEC-007 bis SEC-011 ✅ (XSS Prevention, CORS Hardening, Dependency Audit, Supabase Function Validation)
- [x] Push-Benachrichtigungen nach Build ✅
- [x] Build-Historie ✅
- [x] Syntax-Highlighting im Chat ✅
- [x] Weitere Templates ✅ (Navigation + CRUD Templates hinzugefügt)
- [ ] Optional: Auto-Next-Step-Assistent

---

## 📋 Security-Issues
| Issue | Beschreibung | Status |
|-------|--------------|--------|
| SEC-005 | Memory Leaks | ✅ Behoben (Code Review durchgeführt) |
| SEC-006 | Rate Limiting | ✅ Behoben (TokenBucketRateLimiter) |
| SEC-007 | XSS Prevention | ✅ Behoben (Erweiterte Patterns + Sanitization) |
| SEC-008 | Supabase RLS | ⏳ Offen (Datenbank-Konfiguration) |
| SEC-009 | CORS Hardening | ✅ Behoben (Origin-Whitelist + Security Headers) |
| SEC-010 | Dependency Audit | ✅ Behoben (0 Sicherheitslücken gefunden) |
| SEC-011 | Supabase Function Validation | ✅ Behoben (Zod-ähnliche Validierung) |

---

# 🛠️ Development
```bash
npm install
npm start
npm run test
```

---

Fertig. Repo-ready. 💚🚀

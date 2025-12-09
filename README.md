# k1w1-a0style

**React Native App Builder mit KI-Integration** – ähnlich Bolt.new/Lovable.

Eine mobile App zum Erstellen und Bearbeiten von React Native Apps mit KI-Unterstützung, GitHub-Integration und EAS Build-Support.

> **Hinweis:** Der offizielle Package-Name ist `k1w1-a0style-restored` (siehe `package.json`).

---

## 📋 Inhaltsverzeichnis

- [Quick Start](#-quick-start)
- [Projekt-Status](#-projekt-status)
- [Features](#-features)
- [Architektur](#-architektur)
- [Security](#-security)
- [Testing](#-testing)
- [Build & Deploy](#-build--deploy)
- [API-Provider](#-api-provider)
- [Screens & Funktionen](#-screens--funktionen)
- [Verzeichnis-Erklärungen](#-verzeichnis-erklärungen)
- [To-Do Liste](#-to-do-liste)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

```bash
# Dependencies installieren
npm install

# Development starten
npm start

# Tests ausführen
npm test

# Lint prüfen
npm run lint
```

---

## 📊 Projekt-Status

| Kategorie | Status | Details |
|-----------|--------|---------|
| **Security** | ✅ Beta-Ready | 4/11 kritische Issues behoben, Score: 7/10 |
| **Tests** | ✅ 113 Tests | 7/7 Test-Suites passing |
| **EAS Build** | ✅ Konfiguriert | Expo Managed Workflow, APK/AAB ready |
| **UI/UX** | ✅ Modern | Dark Theme, Neon-Grün Akzente, Animationen |
| **Status** | 🎉 **BETA-READY** | App ist stabil und launchbar |

### Aktueller Test-Status

```
Test Suites: 7 passed, 7 total
Tests:       113 passed, 3 skipped, 116 total
Letzter Testlauf: Dezember 2025
```

---

## ✨ Features

### 🤖 KI-Integration
- **Multi-Provider Support**: Groq, Gemini, OpenAI, Anthropic, HuggingFace
- **Automatisches Fallback**: Bei Fehler → nächster Provider
- **Key-Rotation**: Automatische Rotation bei Rate Limits
- **Quality Modes**: Speed vs. Quality

### 📁 Projekt-Management
- **File-Editor**: Erstellen, Bearbeiten, Löschen von Dateien
- **ZIP Import/Export**: Projekte als ZIP teilen
- **Template-System**: Expo SDK 54 Base-Template
- **Syntax-Validierung**: Fehler-Erkennung in Echtzeit

### 🔗 GitHub-Integration
- **Repository-Verknüpfung**: Connect mit GitHub Repos
- **Commit & Push**: Änderungen direkt committen
- **Workflow-Status**: GitHub Actions Live-Logs
- **API-Backup**: Keys exportieren/importieren

### 🏗️ Build System
- **EAS Build**: Preview, Development, Production Profiles
- **Live-Status**: Echtzeit Build-Fortschritt
- **Fehleranalyse**: Automatische Erkennung & Lösungsvorschläge
- **Download**: APK/AAB direkt in der App

### 🖥️ Terminal
- **Console-Logs**: Alle Logs in Echtzeit
- **Filter**: Nach Level filtern (Info, Warn, Error)
- **Suche**: Logs durchsuchen
- **Export**: JSON/TXT Export

---

## 🎯 Architektur

### Verzeichnisstruktur

```
k1w1-a0style/
├── screens/              # App-Screens (11 Screens)
│   ├── ChatScreen.tsx    # KI-Chat Interface
│   ├── CodeScreen.tsx    # Datei-Editor
│   ├── BuildScreen.tsx   # Build-Management
│   ├── TerminalScreen.tsx# Console-Logs
│   └── ...
├── contexts/             # React Context (7 Dateien)
│   ├── AIContext.tsx     # KI-Konfiguration (mit Mutex)
│   ├── ProjectContext.tsx# Projekt-State (mit Mutex)
│   └── ...
├── lib/                  # Core-Logik (15 Module)
│   ├── orchestrator.ts   # KI-Provider-Orchestrierung
│   ├── SecureKeyManager.ts # Sichere Key-Verwaltung
│   ├── validators.ts     # Input-Validierung (Zod)
│   └── __tests__/        # Lib-Tests (2 Dateien)
├── hooks/                # Custom React Hooks (5 Hooks)
├── components/           # UI-Komponenten (11 Components)
├── utils/                # Helper-Funktionen (4 Dateien)
├── supabase/             # Supabase Edge Functions
│   └── functions/        # 7 Serverless Functions + _shared
├── templates/            # Projekt-Templates (1 Template)
├── __tests__/            # Haupt-Tests (5 Dateien)
├── __mocks__/            # Jest Mocks (7 Mocks)
├── android_backup/       # Backup der Android-Konfiguration
├── coverage/             # Jest Coverage Reports (generiert)
└── assets/               # App-Icons (2 Dateien)
```

### Datei-Übersicht (Aktuell)

| Kategorie | Anzahl | Dateien |
|-----------|--------|---------|
| **Screens** | 11 | AppInfoScreen, BuildScreen, ChatScreen, CodeScreen, ConnectionsScreen, DiagnosticScreen, EnhancedBuildScreen, GitHubReposScreen, PreviewScreen, SettingsScreen, TerminalScreen |
| **Components** | 11 | Breadcrumb, CreationDialog, CustomDrawer, CustomHeader, ErrorBoundary, FileActionsModal, FileItem, FileTree, MessageItem, RepoListItem, SyntaxHighlighter |
| **Hooks** | 5 | useBuildStatus, useBuildStatusSupabase, useBuildTrigger, useGitHubActionsLogs, useGitHubRepos |
| **lib/** | 15 | buildErrorAnalyzer, buildStatusMapper, fileWriter, normalizer, orchestrator, promptEngine, prompts, RateLimiter, retryWithBackoff, SecureKeyManager, SecureTokenManager, supabase, supabaseTypes, tokenEstimator, validators |
| **contexts/** | 7 | AIContext, GitHubContext, githubService, ProjectContext, projectStorage, TerminalContext, types |
| **utils/** | 4 | chatUtils, metaCommands, projectSnapshot, syntaxValidator |
| **Mocks** | 7 | async-storage, expo-constants, expo-crypto, expo-file-system, expo-secure-store, react-native-zip-archive, uuid |
| **Supabase Functions** | 7 | check-eas-build, github-workflow-dispatch, github-workflow-logs, github-workflow-runs, k1w1-handler, test, trigger-eas-build |

### Tech Stack

| Kategorie | Technologie |
|-----------|-------------|
| **Framework** | React Native (Expo SDK 54) |
| **Language** | TypeScript (Strict Mode) |
| **State** | React Context API + async-mutex |
| **Backend** | Supabase (Edge Functions, Auth) |
| **Build** | EAS Build (Expo Managed Workflow) |
| **Tests** | Jest + Testing Library |
| **Validation** | Zod |

---

## 🔐 Security

### ✅ Behobene Issues (Woche 1)

| Issue | Beschreibung | Status |
|-------|--------------|--------|
| **SEC-001** | API Keys aus globalThis entfernt | ✅ `SecureKeyManager.ts` |
| **SEC-002** | Input Validation implementiert | ✅ `validators.ts` (Zod) |
| **SEC-003** | Token Encryption hinzugefügt | ✅ `SecureTokenManager.ts` |
| **SEC-004** | Race Conditions behoben | ✅ Mutex in ProjectContext + AIContext |

### 📋 Geplante Issues (Woche 2-5)

| Issue | Beschreibung | Priorität |
|-------|--------------|-----------|
| **SEC-005** | Memory Leaks beheben | 🟡 Mittel |
| **SEC-006** | Rate Limiting implementieren | 🟡 Mittel |
| **SEC-007** | XSS Prevention | 🟢 Niedrig |
| **SEC-008** | Supabase RLS | 🟢 Niedrig |
| **SEC-009** | CORS Hardening | 🟢 Niedrig |
| **SEC-010** | Dependency Audit | 🟡 Mittel |
| **SEC-011** | Supabase Function Validation | 🟢 Niedrig |

### Security Best Practices

```typescript
// ❌ FALSCH: Keys in globalThis
(global as any).API_KEY = key;

// ✅ RICHTIG: SecureKeyManager verwenden
import SecureKeyManager from './lib/SecureKeyManager';
SecureKeyManager.setKeys('groq', ['key1', 'key2']);
const key = SecureKeyManager.getCurrentKey('groq');
```

```typescript
// ❌ FALSCH: Keine Validierung
const createFile = (path: string) => fs.write(path, content);

// ✅ RICHTIG: Mit Validierung
import { FilePathSchema } from './lib/validators';
const validated = FilePathSchema.parse(path); // Throws bei Fehler
```

---

## 🧪 Testing

### Test-Befehle

```bash
npm test                  # Alle Tests ausführen
npm run test:watch        # Watch Mode
npm run test:coverage     # Mit Coverage-Report
npm run test:verbose      # Verbose Output
npm run test:clear        # Cache leeren
```

### Test-Status (Aktuell)

| Modul | Tests | Status |
|-------|-------|--------|
| `SecureKeyManager` | 16 | ✅ Passing |
| `validators` | 40+ | ✅ Passing |
| `smoke tests` | 50+ | ✅ Passing |
| `chatParsing` | 5 | ✅ Passing |
| `jsonTruncation` | 3 | ✅ Passing |
| `navigation.smoke` | ~5 | ✅ Passing |
| `App.test` | ~3 | ✅ Passing |
| **Gesamt** | **113** | ✅ **7/7 Suites** |

### Vorhandene Mocks (`__mocks__/`)

| Mock | Datei | Beschreibung |
|------|-------|--------------|
| `@react-native-async-storage/async-storage` | `async-storage.js` | AsyncStorage Mock |
| `expo-secure-store` | `expo-secure-store.js` | SecureStore Mock |
| `expo-file-system` | `expo-file-system.js` | FileSystem Mock |
| `expo-constants` | `expo-constants.js` | Constants Mock |
| `expo-crypto` | `expo-crypto.js` | Crypto Mock |
| `react-native-zip-archive` | `react-native-zip-archive.js` | ZIP-Archiv Mock |
| `uuid` | `uuid.js` | UUID Mock |

### Test-Dateien

```
__tests__/
├── App.test.tsx              # App-Komponenten-Test
├── chatParsing.test.ts       # Chat-Parsing Tests
├── jsonTruncation.test.ts    # JSON-Truncation Tests
├── navigation.smoke.test.tsx # Navigation Smoke Tests
└── smoke.test.ts             # Allgemeine Smoke Tests

lib/__tests__/
├── SecureKeyManager.test.ts  # SecureKeyManager Tests
└── validators.test.ts        # Zod Validators Tests
```

---

## 🏗️ Build & Deploy

### EAS Build

```bash
# Preview Build (APK)
eas build --platform android --profile preview

# Production Build (AAB)
eas build --platform android --profile production

# Development Build
eas build --platform android --profile development
```

### Build Profiles (eas.json)

| Profil | Output | Verwendung |
|--------|--------|------------|
| `development` | APK (Debug) | Lokale Entwicklung mit Dev-Client |
| `preview` | APK (Release) | Interne Tests |
| `production` | AAB | Store-Submission |

### Build-Workflow

Dieses Projekt verwendet **Expo Managed Workflow**:

- `android/` und `ios/` werden NICHT im Repository gehalten
- EAS Build generiert die nativen Verzeichnisse automatisch
- `.easignore` und `.gitignore` schließen `android/` und `ios/` aus
- Kotlin-Konfiguration wird über `android_backup/` dokumentiert (siehe unten)

---

## 🤖 API-Provider

### Unterstützte Provider

| Provider | Modelle | Speed | Quality |
|----------|---------|-------|---------|
| **Groq** | llama-3.3-70b, mixtral-8x7b | ⚡ Sehr schnell | 🟢 Gut |
| **Gemini** | gemini-1.5-pro, gemini-2.0-flash | ⚡ Schnell | 🟢 Sehr gut |
| **OpenAI** | gpt-4o, gpt-4o-mini | 🟡 Mittel | 🟢 Exzellent |
| **Anthropic** | claude-3.5-sonnet, claude-3-opus | 🟡 Mittel | 🟢 Exzellent |
| **HuggingFace** | Diverse Open-Source | ⚡ Variabel | 🟡 Variabel |

### Key-Konfiguration

1. **In der App**: Settings → API-Keys
2. **Backup/Restore**: AppInfo → API-Backup exportieren/importieren

---

## 📱 Screens & Funktionen

### Übersicht (11 Screens)

| Screen | Funktion |
|--------|----------|
| **ChatScreen** | KI-Chat für Code-Generierung |
| **CodeScreen** | Datei-Editor mit Syntax-Highlighting |
| **PreviewScreen** | App-Vorschau (WebView) |
| **BuildScreen** | Build-Status & Trigger |
| **EnhancedBuildScreen** | Erweiterte Build-Ansicht mit Logs |
| **TerminalScreen** | Console-Logs mit Filter & Export |
| **SettingsScreen** | API-Keys & Provider-Auswahl |
| **ConnectionsScreen** | GitHub & Expo Verbindung |
| **GitHubReposScreen** | Repository-Auswahl |
| **AppInfoScreen** | App-Name, Icon, Backup |
| **DiagnosticScreen** | Debug-Informationen |

---

## 📁 Verzeichnis-Erklärungen

### `android_backup/`

**Zweck:** Backup der Android-Konfiguration für Referenz und Troubleshooting.

Dieses Verzeichnis enthält eine gesicherte Kopie der Android-Build-Konfiguration, die bei einem `expo prebuild` generiert wurde. Es dient als Referenz für:

- **Kotlin-Version**: `kotlinVersion=2.0.21` (für KSP-Kompatibilität)
- **Gradle-Konfiguration**: `androidGradlePluginVersion=8.7.3`
- **App-Icons**: Adaptive Icons in allen Auflösungen
- **Splash-Screen**: Konfigurierte Splash-Images

> ⚠️ **Wichtig:** Dieser Ordner wird NICHT für EAS Builds verwendet. Bei Expo Managed Workflow werden die nativen Verzeichnisse automatisch von EAS generiert. Das Backup dient nur zur Dokumentation und für den Fall, dass man auf Bare Workflow wechseln möchte.

### `coverage/`

**Zweck:** Jest Coverage Reports (automatisch generiert).

Wird durch `npm run test:coverage` erstellt und enthält HTML-Reports zur Code-Coverage-Analyse. Dieser Ordner sollte nicht committed werden (ist aber aktuell im Repo für Referenz).

### `templates/`

**Zweck:** Projekt-Templates für neue Projekte.

Enthält aktuell ein Template:
- `expo-sdk54-base.json` - Basis-Template für Expo SDK 54 Projekte

---

## 📋 To-Do Liste

### ✅ Erledigt

- [x] **Security**: SecureKeyManager implementiert
- [x] **Security**: Input Validation mit Zod
- [x] **Security**: Token Encryption
- [x] **Security**: Race Conditions behoben (async-mutex)
- [x] **Tests**: Jest Setup komplett
- [x] **Tests**: 113 Tests implementiert (7/7 Suites passing)
- [x] **Tests**: Mocks für alle Dependencies (7 Mocks)
- [x] **Tests**: Mock für react-native-zip-archive erstellt
- [x] **Build**: EAS Konfiguration (Managed Workflow)
- [x] **Build**: EnhancedBuildScreen mit Live-Logs
- [x] **UI**: Terminal Enhancements (Filter, Suche, Export)
- [x] **UI**: Chat Animationen & Optimierungen
- [x] **UI**: AppInfoScreen mit Icon-Picker & API-Backup
- [x] **Hooks**: useBuildStatus, useGitHubActionsLogs
- [x] **Docs**: README aktualisiert (Dezember 2025)
- [x] **.gitignore**: Merge-Konflikt behoben

### 🔄 In Arbeit / Geplant

#### Priorität: Hoch
- [ ] Test Coverage erhöhen (Ziel: 40%)
- [ ] fileWriter.test.ts schreiben
- [ ] orchestrator.test.ts erweitern
- [ ] Web-Favicon hinzufügen oder Referenz entfernen (`app.config.js` → `web.favicon`)

#### Priorität: Mittel
- [ ] CI/CD Integration für Tests (GitHub Actions)
- [ ] Integration Tests (AI + Orchestrator)
- [ ] SEC-005: Memory Leaks beheben
- [ ] SEC-006: Rate Limiting implementieren
- [ ] SecureTokenManager.test.ts schreiben
- [ ] `coverage/` aus Git entfernen (nur lokal generieren)

#### Priorität: Niedrig
- [ ] E2E Tests mit Detox
- [ ] SEC-007 bis SEC-011 beheben
- [ ] Push-Benachrichtigungen bei Build-Completion
- [ ] Build-Historie mit Statistiken
- [ ] Code-Syntax-Highlighting in Chat
- [ ] Weitere Templates erstellen

---

## 🛠️ Development

### Requirements

- Node.js >= 20.0.0
- npm >= 10.0.0
- Expo CLI
- EAS CLI (für Builds)

### Umgebung einrichten

```bash
# Repository klonen
git clone https://github.com/your-repo/k1w1-a0style.git
cd k1w1-a0style

# Dependencies installieren
npm install

# Development starten
npm start
```

### Neue Tests schreiben

```typescript
// lib/__tests__/MyModule.test.ts
describe('MyModule', () => {
  it('sollte korrekt funktionieren', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Supabase Functions deployen

```bash
cd supabase/functions
supabase functions deploy <function-name>
```

---

## 🐛 Troubleshooting

### Tests schlagen fehl

```bash
# Cache leeren
npm run test:clear
npm install
npm test
```

### Build-Fehler (Kotlin)

Bei Kotlin/KSP-Problemen: Die Referenz-Konfiguration liegt in `android_backup/gradle.properties`:
```properties
kotlinVersion=2.0.21
androidGradlePluginVersion=8.7.3
```

> **Hinweis:** Bei Expo Managed Workflow werden diese Werte von EAS automatisch konfiguriert. Bei Problemen kann ein `expo prebuild --clean` helfen.

### API-Keys funktionieren nicht

1. Prüfe Key-Format im Settings-Screen
2. Verifiziere Provider-Status auf deren Websites
3. Prüfe Rate-Limits

### App startet nicht

```bash
# Expo Cache leeren
npx expo start --clear
```

### Web-Favicon fehlt

Das Projekt referenziert `./assets/favicon.png` in `app.config.js`, aber die Datei fehlt. Optionen:
1. Favicon-Datei hinzufügen
2. Web-Config entfernen (wenn kein Web-Support benötigt wird)

---

## 📚 Weitere Ressourcen

- [Expo Documentation](https://docs.expo.dev)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Zod Documentation](https://zod.dev)

---

## 📝 Changelog

### Version 1.0.0 (Dezember 2025)

**Security:**
- ✅ SecureKeyManager für sichere API-Key-Verwaltung
- ✅ Input Validation mit Zod-Schemas
- ✅ Token Encryption mit IV und Key-Stretching
- ✅ Race Conditions mit async-mutex behoben (AIContext + ProjectContext)

**Testing:**
- ✅ Jest Setup mit 113 Tests (7/7 Suites passing)
- ✅ 7 Mocks für Expo-Module und Dependencies
- ✅ Mock für react-native-zip-archive implementiert

**Build:**
- ✅ EAS Build konfiguriert (Expo Managed Workflow)
- ✅ APK/AAB Build-Profile
- ✅ Enhanced Build Screen mit Live-Logs

**UI/UX:**
- ✅ Terminal mit Filter, Suche, Export
- ✅ Chat mit Animationen
- ✅ AppInfoScreen mit Icon-Picker & API-Backup

**Dokumentation:**
- ✅ README vollständig aktualisiert
- ✅ .gitignore bereinigt (Merge-Konflikt behoben)
- ✅ android_backup/ dokumentiert

---

## 📞 Support

**Issues?** → GitHub Issues erstellen

---

**Status:** 🎉 BETA-READY  
**Letztes Update:** Dezember 2025  
**Version:** 1.0.0

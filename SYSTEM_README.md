
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
- `templates/` (3 Templates: base, navigation, crud)
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

## 3.3 RateLimiter (`lib/RateLimiter.ts`) ✅ VERBESSERT
Der RateLimiter wurde erweitert mit:

### Klassen:
- **RateLimiter**: Einfacher Sliding-Window Rate Limiter
- **TokenBucketRateLimiter**: Token Bucket Algorithm für bessere Burst-Handling
- **ProviderRateLimiterManager**: Verwaltet separate Rate Limits pro AI-Provider

### Features:
- Provider-spezifische Rate Limits (Groq, OpenAI, Anthropic, Gemini, HuggingFace)
- Token-Bucket-Algorithmus für gleichmäßigere Request-Verteilung
- Burst-Limit-Schutz
- Automatisches Token-Refill über Zeit
- Status-Monitoring (getStatus(), getAllStatus())

### Verwendung:
```ts
import { providerRateLimiter } from '../lib/RateLimiter';

// Vor jedem API-Call
await providerRateLimiter.checkLimit('groq');

// Status abrufen
const status = providerRateLimiter.getStatus('groq');
console.log(`Remaining: ${status.remaining}/${status.total}`);
```

### KI-Regel:
→ IMMER providerRateLimiter.checkLimit() vor AI-API-Calls verwenden.

---

## 3.4 Project Analyzer ✅ VERBESSERT
Analysiert geladene Projekte im DiagnosticScreen:

### Features (NEU erweitert):
- prüft `app.config.js` und validiert Android Package Name
- prüft iOS bundleIdentifier
- erkennt Expo SDK Version automatisch
- listet alle Probleme kategorisiert (Error, Warning, Info)
- **Security Checks**: API-Keys, Passwörter, eval(), dangerouslySetInnerHTML
- **Dependency Analyse**: Deprecated Packages, veraltete Versionen
- **Code Quality**: console.log, TODO/FIXME, @ts-ignore ohne Erklärung
- **Multi-Fix**: Mehrere Issues gleichzeitig zur KI senden

### Neue Funktionen:
- `selectAllFixable()` - Alle fixbaren Issues auswählen
- `sendMultipleIssuesToChat()` - Mehrere Issues gleichzeitig fixen
- Priority-System (high, medium, low) für Issues

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

### 8.3 Nachrichten-Ränder abgeschnitten ✅ BEHOBEN
**Fix:** MessageItem Layout verbessert:
- marginHorizontal auf Container hinzugefügt
- flexShrink und flexWrap für Text-Styles
- maxWidth auf 88% erhöht, minWidth hinzugefügt

---

### 8.4 Chat Syntax Highlighting ✅ NEU IMPLEMENTIERT
**Feature:** Code-Blöcke in Chat-Nachrichten werden jetzt mit Syntax Highlighting dargestellt:
- Erkennung von ```language...``` Markdown-Blöcken
- Syntax Highlighting für TypeScript, JavaScript, JSX, etc.
- Copy-Button für jeden Code-Block
- Zeilennummern bei längeren Code-Blöcken (>3 Zeilen)
- Scrollbare Code-Blöcke für lange Inhalte

---

# 9. 📋 Vollständige ToDo-Liste (Neu strukturiert + Prioritäten)

**Stand:** 9. Dezember 2025 (aktualisiert)  
**Tests:** 330 passed (327 + 3 skipped), 17 Suites  
**Coverage:** ~40% (Ziel erreicht!)

## ✅ COMPLETED (9. Dezember 2025)
- [x] ZIP-Import implementieren  
- [x] ChatScreen Input fixen (Keyboard + Position)  
- [x] DiagnosticScreen Auto-Fix (KI soll automatisch reagieren)  
- [x] GitHub Funktionen erweitern (Delete, Create, Pull, Push)  
- [x] PreviewScreen → AppStatusScreen umbenennen  
- [x] fileWriter.test.ts erstellen  
- [x] SecureTokenManager.test.ts erstellen  
- [x] coverage/ Ordner aus Git entfernen (.gitignore aktualisieren)  
- [x] **buildErrorAnalyzer.test.ts erstellen** ✅ NEU
- [x] **RateLimiter.test.ts erstellen** ✅ NEU
- [x] **tokenEstimator.test.ts erstellen** ✅ NEU
- [x] **retryWithBackoff.test.ts erstellen** ✅ NEU
- [x] **normalizer.test.ts erstellen** ✅ NEU
- [x] **SEC-006: Rate Limiting verbessern** ✅ NEU (Token Bucket Algorithm implementiert)
- [x] **Project Analyzer verbessern** ✅ NEU (Expo SDK Detection, Security Checks, Dependency Analysis)
- [x] **Mehrere Diagnose-Fixes gleichzeitig ausführen** ✅ NEU (Multi-Fix Button)
- [x] **Mehr Templates hinzufügen** ✅ NEU (Navigation + CRUD Templates)
- [x] **Chat Syntax Highlighting** ✅ NEU (Code-Blöcke in Nachrichten)
- [x] **Build-Historie implementieren** ✅ NEU (9. Dezember 2025)
- [x] **SEC-007: XSS Prevention** ✅ NEU (Erweiterte XSS-Patterns + Sanitization)
- [x] **SEC-009: CORS Hardening** ✅ NEU (Origin-Whitelist + Security Headers)
- [x] **SEC-011: Supabase Function Validation** ✅ NEU (Zod-ähnliche Input-Validierung)
- [x] **buildHistoryStorage.test.ts erstellen** ✅ NEU (18 neue Tests)

## 🔥 HIGH PRIORITY
- [ ] Echten PreviewScreen bauen (Bolt-Style Live-Preview)  
- [x] Project Analyzer verbessern ✅ ERLEDIGT
- [x] Test Coverage auf 40% erhöhen ✅ ERREICHT

## 🟡 MEDIUM
- [x] Integration Tests (AI + Orchestrator) ✅ Bereits vorhanden (AIContext.integration.test.ts)
- [x] SEC-005: Memory Leaks - Code Review durchgeführt, keine kritischen Leaks gefunden
- [x] SEC-006: Rate Limiting verbessern ✅ TokenBucketRateLimiter + ProviderRateLimiterManager
- [x] Mehrere Diagnose-Fixes gleichzeitig ausführen ✅ ERLEDIGT

## 🟢 LOW
- [x] Build-Historie implementieren ✅ ERLEDIGT (EnhancedBuildScreen erweitert)
- [x] Mehr Templates hinzufügen ✅ ERLEDIGT (2 neue Templates)
- [ ] Push-Benachrichtigungen nach Build  
- [x] Chat Syntax Highlighting ✅ ERLEDIGT
- [ ] E2E Tests mit Detox  
- [x] SEC-007: XSS Prevention ✅ ERLEDIGT (validators.ts erweitert)
- [ ] SEC-008: Supabase RLS (Datenbank-Konfiguration, kein Code)
- [x] SEC-009: CORS Hardening ✅ ERLEDIGT (_shared/cors.ts)
- [ ] SEC-010: Dependency Audit (manuell mit npm audit)
- [x] SEC-011: Supabase Function Validation ✅ ERLEDIGT (_shared/validation.ts)  

---

# 10. 🧪 Tests
**Status:** 330 Tests passed, 17 Test Suites (3 Tests skipped)  
**Coverage:** ~40%

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
- `lib/__tests__/orchestrator.test.ts` ✅ NEU (9. Dezember 2025)
- `lib/__tests__/AIContext.integration.test.ts` ✅ NEU (9. Dezember 2025)
- `lib/__tests__/buildErrorAnalyzer.test.ts` ✅ NEU (9. Dezember 2025)
- `lib/__tests__/RateLimiter.test.ts` ✅ NEU (9. Dezember 2025)
- `lib/__tests__/tokenEstimator.test.ts` ✅ NEU (9. Dezember 2025)
- `lib/__tests__/retryWithBackoff.test.ts` ✅ NEU (9. Dezember 2025)
- `lib/__tests__/normalizer.test.ts` ✅ NEU (9. Dezember 2025)
- `lib/__tests__/buildHistoryStorage.test.ts` ✅ NEU (9. Dezember 2025)

### Fehlende Tests (TODO):
- [ ] E2E Tests mit Detox

---

# 10.1 📜 Build-Historie (NEU)
**Feature implementiert:** 9. Dezember 2025

### Funktionen:
- Speichert bis zu 50 vergangene Builds in AsyncStorage
- Zeigt Build-Status (success/failed/building/queued)
- Zeigt Build-Dauer und Zeitstempel
- Direkter Download-Link für APK-Artefakte
- Löschen einzelner Einträge (Long-Press)
- Gesamte Historie löschen

### Dateien:
- `lib/buildHistoryStorage.ts` - Storage-Funktionen
- `hooks/useBuildHistory.ts` - React Hook
- `contexts/types.ts` - BuildHistoryEntry Type
- `screens/EnhancedBuildScreen.tsx` - UI Integration

### Verwendung:
```tsx
import { useBuildHistory } from '../hooks/useBuildHistory';

const { history, stats, startBuild, completeBuild } = useBuildHistory();

// Neuen Build starten
await startBuild(jobId, 'user/repo', 'preview');

// Build abschließen
await completeBuild(jobId, 'success', { artifactUrl: '...' });
```  

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

# 14. 📁 Templates (3 Stück) ✅ ERWEITERT
Verfügbare Projekt-Templates in `/templates/`:

### expo-sdk54-base.json
Basis-Template mit:
- TypeScript + Zod Validation
- Expo SDK 54 konfiguriert
- Dark Theme
- env.ts für Runtime-Env-Validation

### expo-sdk54-navigation.json ✅ NEU
Navigation-Template mit:
- React Navigation (Bottom Tabs + Stack)
- 5 vorkonfigurierte Screens (Home, Explore, Profile, Settings, Details)
- TypeScript Navigation Types
- @expo/vector-icons integriert

### expo-sdk54-crud.json ✅ NEU
CRUD-Template mit:
- AsyncStorage für lokale Persistenz
- Create, Read, Update, Delete Operationen
- FAB (Floating Action Button)
- Modal für Add/Edit
- Dark Theme

---

# 15. 📚 Supabase Functions (7 Stück)
Die KI darf diese erweitern, aber:

- keine Breaking Changes  
- Input/Output strikt definieren  
- Logs sauber halten

---

# 15.1 🔒 Security Improvements (NEU)
**Implementiert:** 9. Dezember 2025

## SEC-007: XSS Prevention ✅
Erweiterte XSS-Schutz in `lib/validators.ts`:
- Erkennung von 12+ gefährlichen Patterns (script, iframe, onclick, javascript:, etc.)
- Automatische Sanitization statt Ablehnung
- `hadXSS` Flag zeigt an, ob Content bereinigt wurde

```ts
import { validateChatInput, sanitizeForXSS } from '../lib/validators';

const result = validateChatInput(userInput);
if (result.hadXSS) {
  console.log('XSS-Versuch erkannt und bereinigt');
}
```

## SEC-009: CORS Hardening ✅
Verbesserte CORS-Konfiguration in `supabase/functions/_shared/cors.ts`:
- Origin-Whitelist für Produktion
- Automatische Erkennung von Entwicklungsumgebungen
- Security Headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Helper-Funktionen: `jsonResponse()`, `errorResponse()`

## SEC-011: Supabase Function Validation ✅
Neue Validierungsmodule in `supabase/functions/_shared/validation.ts`:
- `validateGitHubRepo()` - Format und Path-Traversal-Schutz
- `validateBuildProfile()` - Nur erlaubte Profile (development, preview, production)
- `validateJobId()` - Integer-Validierung mit Grenzwerten
- `validateTriggerBuildRequest()` - Komplette Request-Body-Validierung

### Integration in Supabase Functions:
```ts
import { validateTriggerBuildRequest } from '../_shared/validation.ts';
import { errorResponse } from '../_shared/cors.ts';

const validation = validateTriggerBuildRequest(body);
if (!validation.valid) {
  return errorResponse('Validation failed', req, 400, { errors: validation.errors });
}
```  

---

# 16. 🎉 Schlusswort
Dies ist die vollständige System-Dokumentation für Cursor.  
Alle Module, Bugs, Features und Logiken sind enthalten.

KI kann ab jetzt:

- Code korrekt generieren  
- Fehler richtig interpretieren  
- neue Features kompatibel entwickeln  

ENDE.

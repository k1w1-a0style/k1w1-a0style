# 🚀 k1w1 Build System - Vollständige Dokumentation

## Übersicht

Das k1w1 Build System bietet eine vollautomatische, CI/CD-integrierte Lösung für den Build-Prozess mit Live-Monitoring, automatischer Fehleranalyse und GitHub Actions Integration.

## ✨ Features

### 1. **Live Build Status** 📊
- Echtzeit-Überwachung des Build-Prozesses
- Automatisches Polling alle 6 Sekunden
- Fortschrittsbalken mit geschätzter Restzeit
- Verstrichene Zeit Tracking

### 2. **Automatische Fehleranalyse** 🔍
- KI-gestützte Fehlererkennung
- Kategorisierung nach Schweregrad (Critical, High, Medium, Low)
- Konkrete Lösungsvorschläge
- Links zur offiziellen Dokumentation
- Relevante Log-Auszüge

### 3. **GitHub Actions Live Logs** 📜
- Echtzeit-Streaming der Build-Logs
- Farbcodierung nach Log-Level (Info, Warning, Error)
- Zeitstempel für jeden Log-Eintrag
- Automatische Aktualisierung während des Builds

### 4. **Optimierte EAS Konfiguration** ⚙️
- Drei Build-Profile (Development, Preview, Production)
- Cache-Optimierung für schnellere Builds
- Resource Class Management
- Separate Android Build-Types (APK für Preview, App Bundle für Production)

### 5. **GitHub Actions Workflows** 🔄
- **CI Build**: Automatischer Build bei Push/PR
- **Release Build**: Manueller Build mit Workflow Dispatch
- Artifact Upload & Download
- Build Summary Generation

## 📁 Architektur

```
k1w1/
├── screens/
│   ├── BuildScreen.tsx              # Original Build Screen
│   └── EnhancedBuildScreen.tsx      # Neue Enhanced Version mit allen Features
├── hooks/
│   ├── useBuildStatus.ts            # Polling für Build Status
│   ├── useBuildTrigger.ts           # Build Trigger Logic
│   └── useGitHubActionsLogs.ts      # GitHub Actions Log Streaming (NEU)
├── lib/
│   └── buildErrorAnalyzer.ts        # Automatische Fehleranalyse (NEU)
├── supabase/functions/
│   ├── check-eas-build/             # Status Check Endpoint
│   ├── trigger-eas-build/           # Build Trigger Endpoint
│   ├── github-workflow-logs/        # GitHub Logs Endpoint (NEU)
│   ├── github-workflow-runs/        # GitHub Runs Endpoint (NEU)
│   └── github-workflow-dispatch/    # Workflow Dispatch Endpoint (NEU)
├── .github/workflows/
│   ├── ci-build.yml                 # CI Build Workflow (OPTIMIERT)
│   └── release-build.yml            # Release Build Workflow (OPTIMIERT)
└── eas.json                         # EAS Build Configuration (OPTIMIERT)
```

## 🔧 Setup & Installation

### 1. Supabase Edge Functions deployen

```bash
# Alle Funktionen deployen
supabase functions deploy check-eas-build
supabase functions deploy trigger-eas-build
supabase functions deploy github-workflow-logs
supabase functions deploy github-workflow-runs
supabase functions deploy github-workflow-dispatch
```

### 2. Environment Variables konfigurieren

**GitHub Secrets:**
```
EXPO_TOKEN=<dein-expo-token>
```

**Supabase Secrets:**
```bash
supabase secrets set GITHUB_TOKEN=<github-personal-access-token>
supabase secrets set K1W1_SUPABASE_URL=<supabase-project-url>
supabase secrets set K1W1_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### 3. GitHub Personal Access Token

Erforderliche Scopes:
- `repo` (full control)
- `workflow` (manage workflows)
- `read:org` (read organization data)

### 4. Expo Token

Generiere einen Token auf: https://expo.dev/accounts/[account]/settings/access-tokens

## 📊 Build Profiles

### Development
```json
{
  "developmentClient": true,
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```
- Für lokale Entwicklung
- Schnelle Build-Zeiten
- Debug-Modus

### Preview
```json
{
  "distribution": "internal",
  "android": {
    "buildType": "apk",
    "gradleCommand": ":app:assembleRelease"
  },
  "cache": {
    "key": "preview-cache-v1",
    "paths": ["node_modules"]
  }
}
```
- Für interne Tests
- Release Build
- Cache-Optimiert

### Production
```json
{
  "distribution": "store",
  "android": {
    "buildType": "app-bundle"
  },
  "cache": {
    "key": "production-cache-v1",
    "paths": ["node_modules", ".expo"]
  }
}
```
- Für Store-Submission
- App Bundle Format
- Maximale Optimierung

## 🔍 Fehleranalyse-Kategorien

Das System erkennt automatisch folgende Fehlertypen:

| Kategorie | Pattern | Schweregrad | Beispiel |
|-----------|---------|-------------|----------|
| Authentifizierung | `EXPO_TOKEN` | Critical | Token fehlt oder ungültig |
| Dependencies | `npm install failed` | High | Package nicht gefunden |
| Android Build | `gradle failed` | High | Gradle Build Error |
| iOS Build | `pod install failed` | High | CocoaPods Error |
| TypeScript | `TS\d+` | Medium | Type Error |
| Ressourcen | `out of memory` | Critical | Memory Limit |
| Timeout | `timed out` | High | Build Timeout |
| Code Signing | `certificate` | Critical | iOS Signing Problem |
| Import Fehler | `module not found` | High | Missing Module |
| Netzwerk | `ECONNREFUSED` | Medium | Network Error |
| Syntax | `syntax error` | High | JS/TS Syntax Error |

## 🎨 UI/UX Features

### 1. Live Status Card
- Echtzeit-Fortschrittsbalken
- Farbcodierte Status-Anzeige (Grün = Success, Rot = Error)
- Verstrichene Zeit & ETA
- Job ID Tracking

### 2. Timeline View
- Visueller Ablauf des Build-Prozesses
- Status-Icons (✓, •, !)
- Beschreibungen für jeden Schritt

### 3. Error Analysis Card
- Automatische Anzeige bei Fehlern
- Kategorisierung nach Schweregrad
- Lösungsvorschläge mit Icons
- Dokumentations-Links

### 4. GitHub Actions Logs
- Ausklappbares Log-Panel
- Farbcodierung (Error = Rot, Warning = Gelb)
- Monospace Font für bessere Lesbarkeit
- Automatisches Scrollen

### 5. Links & Actions
- Direkter Link zu GitHub Actions
- Download-Button für Artefakte
- URL Validation

## 📱 Verwendung

### Build starten

1. Öffne den Enhanced Build Screen
2. Stelle sicher, dass ein GitHub Repo ausgewählt ist
3. Klicke auf "🚀 Build starten"
4. Der Build wird automatisch getrackt

### Logs ansehen

1. Klicke auf "▶ Anzeigen" im Logs-Bereich
2. Logs werden automatisch aktualisiert
3. Scroll nach unten für neueste Einträge

### Fehleranalyse nutzen

1. Bei Build-Fehler wird automatisch eine Analyse durchgeführt
2. Kritischste Fehler werden zuerst angezeigt
3. Folge den Lösungsvorschlägen
4. Öffne Dokumentations-Links bei Bedarf

## 🚀 Performance-Optimierungen

### Build-Cache
- Node modules werden gecached
- Expo Cache wird wiederverwendet
- Cache Keys pro Profile

### Polling-Strategie
- 6 Sekunden Intervall (optimal für Responsiveness)
- Automatischer Stop bei finalen Status
- Fehler-Counter mit Max-Limit

### UI-Optimierungen
- Lazy Loading von Logs (nur letzte 30 Einträge)
- Pull-to-Refresh Support
- Debounced Updates

## 🔐 Security

### Token Management
- Tokens werden nie im Frontend gespeichert
- Verwendung von Supabase Edge Functions als Proxy
- GitHub Token nur serverseitig

### API Security
- CORS Headers konfiguriert
- Rate Limiting durch GitHub API
- Error Messages sanitized

## 🧪 Testing

### Lokales Testen der Supabase Functions

```bash
# Funktion lokal starten
supabase functions serve github-workflow-logs --env-file .env.local

# Test Request
curl -X POST http://localhost:54321/functions/v1/github-workflow-logs \
  -H "Content-Type: application/json" \
  -d '{"githubRepo": "user/repo", "runId": 123456}'
```

### GitHub Actions Workflow Testing

1. Pushe Code auf einen Test-Branch
2. Beobachte CI Build in Actions Tab
3. Prüfe Build Summary

## 📈 Monitoring

### Build Metriken
- Durchschnittliche Build-Zeit
- Erfolgsrate
- Fehlertypen-Verteilung

### Log-Level
- `info`: Normale Operationen
- `warning`: Potenzielle Probleme
- `error`: Build-Fehler

## 🐛 Troubleshooting

### Build startet nicht
1. Prüfe GitHub Repo Auswahl
2. Verifiziere EXPO_TOKEN in GitHub Secrets
3. Überprüfe Supabase Function Logs

### Keine Logs sichtbar
1. Warte 10-15 Sekunden nach Build-Start
2. Klicke auf "Refresh" (Pull-to-Refresh)
3. Prüfe GitHub Actions URL direkt

### Fehleranalyse fehlt
1. Logs müssen Error-Level Einträge enthalten
2. Patterns müssen matchen
3. Fallback auf generische Analyse

## 🎯 Best Practices

1. **Build-Frequency**: Max 1 Build pro 10 Minuten (Rate Limits)
2. **Cache Management**: Cache-Keys bei großen Änderungen anpassen
3. **Error Handling**: Immer Logs prüfen vor erneutem Build
4. **Testing**: Lokale Tests vor CI Build durchführen
5. **Documentation**: Dokumentations-Links bei Fehlern nutzen

## 🔄 Update-Guide

### Supabase Functions updaten
```bash
supabase functions deploy <function-name>
```

### EAS Config ändern
1. `eas.json` bearbeiten
2. Commit & Push
3. Nächster Build nutzt neue Config

### GitHub Workflows anpassen
1. `.github/workflows/*.yml` bearbeiten
2. Commit & Push
3. Workflow wird automatisch aktualisiert

## 📚 Weitere Ressourcen

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [React Native Performance](https://reactnative.dev/docs/performance)

## 🎉 Features in Entwicklung

- [ ] Build-Historie mit Statistiken
- [ ] Push-Benachrichtigungen bei Build-Completion
- [ ] Automatisches Retry bei Transient Errors
- [ ] Build-Vergleich (Diff zwischen Builds)
- [ ] Integration mit Sentry für Error Tracking
- [ ] Custom Build Scripts Support

---

**Entwickelt mit ❤️ für k1w1**

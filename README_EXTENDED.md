# README_EXTENDED.md
# Dokumentations-Übersicht

**Letzte Aktualisierung:** 9. Dezember 2025

---

## 📚 Dokumentationsstruktur

Dieses Projekt hat drei Dokumentationsdateien mit unterschiedlichen Zwecken:

| Datei | Zweck | Zielgruppe |
|-------|-------|------------|
| `README.md` | Hauptdokumentation, Features, ToDo-Liste | Entwickler, Benutzer |
| `SYSTEM_README.md` | KI-Regeln, Architektur-Details, System-Constraints | Cursor AI, Entwickler |
| `.github/workflows/README.md` | CI/CD Workflows, GitHub Actions | DevOps, Entwickler |

---

## 🔗 Schnelllinks

### Für Entwickler
- [README.md](./README.md) - Features, ToDo-Liste, Setup
- [.github/workflows/README.md](./.github/workflows/README.md) - CI/CD Dokumentation

### Für KI (Cursor)
- [SYSTEM_README.md](./SYSTEM_README.md) - Vollständige Systemdokumentation mit KI-Regeln

---

## 📋 Aktueller Stand (Zusammenfassung)

### ✅ Funktioniert
- Multi-Provider KI (Groq, OpenAI, Gemini, Anthropic, HuggingFace)
- Projekt-Editor mit FileTree
- ZIP-Export
- EAS Build Integration
- GitHub Repos & Workflow Trigger
- 113 Tests (7 Suites)

### ⚠️ In Arbeit / Bekannte Bugs
- ZIP-Import fehlt
- ChatScreen Input-Bug (Keyboard/Position)
- DiagnosticScreen Auto-Fix
- GitHub erweiterte Funktionen (Delete, Create, Pull, Push)
- PreviewScreen → AppStatusScreen Umbenennung

### 📊 Metriken
- **Tests:** 113 passed, 7 Suites
- **Coverage:** ~10% (Ziel: 40%)
- **Security:** 7/11 Issues behoben
- **Screens:** 11
- **Components:** 11
- **Lib Modules:** 15

---

## 🎯 Nächste Schritte (High Priority)

1. ZIP-Import implementieren
2. ChatScreen Input fixen
3. DiagnosticScreen Auto-Fix
4. Test Coverage erhöhen
5. PreviewScreen umbenennen

Für die vollständige ToDo-Liste siehe [README.md](./README.md#-to-do-liste-logisch-sortiert).

---

## 🤖 KI-Hinweise

Wenn du als KI (Cursor) an diesem Projekt arbeitest:

1. **Lies zuerst:** `SYSTEM_README.md` - enthält alle Regeln und Constraints
2. **Verwende immer:** TypeScript, relative Imports, Expo-kompatible Module
3. **Vermeide:** Native Module, Hardcoded Keys, Dateien außerhalb des Projektbaums
4. **Teste:** `npm run test` nach Änderungen

---

**Ende der Dokumentations-Übersicht.**

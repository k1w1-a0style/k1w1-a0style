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
- ZIP-Export ✅
- ZIP-Import ✅ (vollständig implementiert)
- EAS Build Integration
- GitHub Repos & Workflow Trigger
- GitHub Repo-Funktionen (Create/Delete/Pull/Push) ✅
- Push-Benachrichtigungen ✅
- Build-Historie ✅
- Chat Syntax Highlighting ✅
- PreviewScreen (Live-Preview) ✅
- 330 Tests (17 Suites) ✅

### ⚠️ In Arbeit / Bekannte Bugs
✅ Alle kritischen Bugs behoben (9. Dezember 2025)

**Offene Punkte:**
- [ ] E2E Tests mit Detox
- [ ] SEC-008: Supabase RLS (Datenbank-Konfiguration)

### 📊 Metriken
- **Tests:** 330 passed, 17 Suites (3 skipped)
- **Coverage:** ~40% ✅ (Ziel erreicht!)
- **Security:** 10/11 Issues behoben ✅
- **Screens:** 12 (inkl. PreviewScreen)
- **Components:** 11
- **Lib Modules:** 15
- **Hooks:** 6 (inkl. useNotifications)

---

## 🎯 Nächste Schritte (High Priority)

✅ Alle High-Priority-Tasks abgeschlossen (9. Dezember 2025)!

**Verbleibende Aufgaben:**
1. E2E Tests mit Detox
2. SEC-008: Supabase RLS konfigurieren
3. Web-Favicon fixen (optional)

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

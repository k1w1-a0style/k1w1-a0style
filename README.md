# k1w1-a0style

React Native App Builder mit KI-Integration - ähnlich Bolt.new/Lovable.

## 🚀 Quick Start

```bash
# Dependencies installieren
npm install

# Development starten
npm start

# Lint prüfen
npm run lint
```

## 📋 Projekt-Status

| Kategorie | Status | Details |
|-----------|--------|---------|
| **Workflows** | ✅ Optimiert | [Siehe Workflow-Docs](./.github/workflows/README.md) |
| **Code-Review** | ⚠️ Action Items | [Siehe Critical Review](./INDEX_KRITISCHE_REVIEWS.md) |
| **Tests** | ❌ Fehlen | 0% Coverage |
| **Sicherheit** | ⚠️ Kritisch | API-Keys, Input-Validierung |

## 📚 Wichtige Dokumente

### 🔍 Code-Reviews & Optimierungen

**Start hier:** [INDEX_KRITISCHE_REVIEWS.md](./INDEX_KRITISCHE_REVIEWS.md) - Übersicht aller Reviews

#### Code-Review:
- [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) - Schnellübersicht
- [AKTUELLE_KRITISCHE_PRUEFUNG.md](./AKTUELLE_KRITISCHE_PRUEFUNG.md) - Vollständiges Audit
- [CRITICAL_ACTION_ITEMS.md](./CRITICAL_ACTION_ITEMS.md) - Priorisierte Checkliste

#### Workflow-Optimierung:
- [WORKFLOW_OPTIMIERUNG_SUMMARY.md](./WORKFLOW_OPTIMIERUNG_SUMMARY.md) - Schnellübersicht
- [WORKFLOW_KRITISCHE_ANALYSE.md](./WORKFLOW_KRITISCHE_ANALYSE.md) - Detaillierte Analyse
- [WORKFLOW_MIGRATION_COMPLETE.md](./WORKFLOW_MIGRATION_COMPLETE.md) - Migrations-Dokumentation
- [.github/workflows/README.md](./.github/workflows/README.md) - Workflow-Guide

## 🔄 CI/CD Workflows

Dieses Projekt verwendet 3 optimierte GitHub Actions Workflows:

| Workflow | Trigger | Zweck | Build-Zeit |
|----------|---------|-------|------------|
| `ci-build.yml` | Push/PR | Schnelle CI Validierung | ~5-8 min |
| `k1w1-triggered-build.yml` | K1W1 App | Build mit Status-Tracking | ~5-10 min |
| `release-build.yml` | Manuell | Production Builds | ~10-15 min |

**Dokumentation:** [.github/workflows/README.md](./.github/workflows/README.md)

## ⚠️ Kritische Probleme

Das Projekt ist **NICHT production-ready**. Folgende Probleme müssen behoben werden:

### 🔴 Sofort (Diese Woche):
1. ✅ API-Keys aus Global Scope entfernen → SecureStore verwenden
2. ✅ Input-Validierung in ChatScreen implementieren
3. ✅ Error Boundaries hinzufügen

**Aufwand:** 14-21 Stunden

### 🟠 Kurzfristig (Nächste 2 Wochen):
4. ✅ Race Conditions in ProjectContext beheben
5. ✅ Memory Leaks in TerminalContext fixen
6. ✅ Unit-Tests schreiben (>60% Coverage)

**Aufwand:** 33-48 Stunden

**Details:** Siehe [CRITICAL_ACTION_ITEMS.md](./CRITICAL_ACTION_ITEMS.md)

## 🎯 Architektur

### Verzeichnisstruktur:
```
k1w1-a0style/
├── .github/workflows/    # CI/CD Workflows (optimiert)
├── components/           # React Components
├── contexts/            # React Contexts (State Management)
├── lib/                 # Core-Logik (orchestrator, fileWriter, etc.)
├── screens/             # App-Screens
├── supabase/            # Supabase Functions
├── utils/               # Helper-Funktionen
└── hooks/               # Custom React Hooks
```

### Tech Stack:
- **Framework:** React Native (Expo)
- **Language:** TypeScript (Strict Mode)
- **State:** React Context API
- **Backend:** Supabase
- **CI/CD:** GitHub Actions + EAS Build
- **AI Providers:** Groq, Gemini, OpenAI, Anthropic, HuggingFace

## 🔐 Security

**Status:** ⚠️ Kritische Sicherheitslücken vorhanden!

### Bekannte Probleme:
1. 🔴 API-Keys im Global Scope (10/10 Severity)
2. 🔴 Keine Input-Validierung (8/10 Severity)
3. 🟠 Race Conditions (7/10 Severity)

**Details:** [AKTUELLE_KRITISCHE_PRUEFUNG.md](./AKTUELLE_KRITISCHE_PRUEFUNG.md)

## 🧪 Testing

**Status:** ❌ Keine Tests vorhanden

**Geplant:**
- Unit-Tests für `lib/*` und `utils/*`
- Integration-Tests für Contexts
- E2E-Tests für kritische User-Flows

**Target:** >80% Coverage

## 📦 Dependencies

### Production:
- expo ~54.0.18
- react-native 0.81.5
- @supabase/supabase-js ^2.75.0
- expo-secure-store ~15.0.7
- async-mutex ^0.5.0

### Development:
- typescript ~5.9.3
- eslint ^9.0.0

**Node:** >=20.0.0 (siehe package.json engines)

## 🚀 Build & Deploy

### EAS Build (via GitHub Actions):
```bash
# CI Build (automatisch bei Push)
git push origin main

# K1W1 App Build (via Supabase Function)
# → Über K1W1 App triggern

# Release Build (manuell)
gh workflow run release-build.yml -f platform=android -f profile=production
```

### Lokal:
```bash
# Development Build
npx eas build --profile development --platform android

# Production Build
npx eas build --profile production --platform android
```

**Dokumentation:** [.github/workflows/README.md](./.github/workflows/README.md)

## 🐛 Known Issues

1. ✅ ~~Workflow Job ID Bug~~ (GEFIXT)
2. ✅ ~~Redundante Workflows~~ (GEFIXT)
3. ⚠️ API-Keys im Global Scope (OFFEN)
4. ⚠️ Keine Tests (OFFEN)
5. ⚠️ Input-Validierung fehlt (OFFEN)

**Details:** [CRITICAL_ACTION_ITEMS.md](./CRITICAL_ACTION_ITEMS.md)

## 📊 Performance

### Workflow-Optimierung:
- **Vorher:** 15-25 Minuten Build-Zeit
- **Nachher:** 5-8 Minuten Build-Zeit
- **Verbesserung:** 🚀 60-70% schneller!

### Code-Optimierung:
- **Status:** In Progress
- **Target:** 50% weniger Race Conditions, Memory Leaks behoben

## 🤝 Contributing

1. Lese [CRITICAL_ACTION_ITEMS.md](./CRITICAL_ACTION_ITEMS.md) für priorisierte Tasks
2. Erstelle Feature-Branch
3. Implementiere Tests (Required!)
4. Submit Pull Request

**Wichtig:** Keine Pull Requests ohne Tests für neue Features!

## 📝 License

Siehe LICENSE Datei.

---

## 📞 Support

**Workflow-Probleme?** → [.github/workflows/README.md](./.github/workflows/README.md)  
**Code-Reviews?** → [INDEX_KRITISCHE_REVIEWS.md](./INDEX_KRITISCHE_REVIEWS.md)  
**Weitere Fragen?** → GitHub Issues

---

**Letztes Update:** 5. Dezember 2025  
**Status:** In Active Development  
**Production-Ready:** ❌ NO (siehe Critical Action Items)

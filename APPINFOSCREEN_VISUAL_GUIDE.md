# AppInfoScreen - Visuelle Übersicht

## 📱 Screen Layout (von oben nach unten)

```
┌─────────────────────────────────────────┐
│  📱 App-Einstellungen                   │
├─────────────────────────────────────────┤
│                                         │
│  App Name:                              │
│  ┌───────────────────────────────┐ ✓   │
│  │ [Textfeld]                    │     │
│  └───────────────────────────────┘     │
│                                         │
│  Package Name (Slug):                   │
│  ┌───────────────────────────────┐ ✓   │
│  │ [Textfeld]                    │     │
│  └───────────────────────────────┘     │
│  ℹ️ Ändert package.json und app.config │
│                                         │
│  App Icon & Assets:                     │
│  ┌───────────────────────────────────┐ │
│  │ 🖼️  App Assets auswählen...      │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Gesetzte Assets:                       │
│  ✅ icon.png                            │
│  ✅ adaptive-icon.png                   │
│  ✅ splash.png                          │
│  ✅ favicon.png                         │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  💾 API-Backup & Wiederherstellung      │
├─────────────────────────────────────────┤
│                                         │
│  Exportiere oder importiere alle API-  │
│  Keys und Einstellungen als Datei.     │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │ ⬇️ Export  │  │ ☁️ Importieren │  │
│  └─────────────┘  └─────────────────┘  │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  🔑 Aktive API-Keys                     │
├─────────────────────────────────────────┤
│                                         │
│  Alle aktuell integrierten und aktiven │
│  API-Keys (der erste Key wird           │
│  verwendet):                            │
│                                         │
│  ⚙️ Groq                          [2]   │
│  ┌───────────────────────────────────┐ │
│  │ 🟢 Aktiv                          │ │
│  │ gsk_xxxxxxxxxxxxxxxxxx            │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │ #2                                │ │
│  │ gsk_yyyyyyyyyyyyyyyyyy            │ │
│  └───────────────────────────────────┘ │
│                                         │
│  🤖 Gemini                        [1]   │
│  ┌───────────────────────────────────┐ │
│  │ 🟢 Aktiv                          │ │
│  │ AIzaSyxxxxxxxxxxxxxxxxxx          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  🧠 OpenAI                        [1]   │
│  ┌───────────────────────────────────┐ │
│  │ 🟢 Aktiv                          │ │
│  │ sk-proj-xxxxxxxxxxxxxxxxxx        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  🧩 Anthropic                     [1]   │
│  ┌───────────────────────────────────┐ │
│  │ 🟢 Aktiv                          │ │
│  │ sk-ant-xxxxxxxxxxxxxxxxxx         │ │
│  └───────────────────────────────────┘ │
│                                         │
│  📦 HuggingFace                   [0]   │
│  Keine Keys konfiguriert               │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  📦 Projekt-Template                    │
├─────────────────────────────────────────┤
│                                         │
│  Template:         Expo SDK 54 Basis    │
│  Expo SDK:         54.0.18              │
│  React Native:     0.81.4               │
│  Standard-Dateien: 42                   │
│                                         │
│  ℹ️ Neue Projekte starten automatisch  │
│     mit diesem Template.                │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  ℹ️ Aktuelles Projekt                   │
├─────────────────────────────────────────┤
│                                         │
│  Projekt-ID:       abc123def456...      │
│  Dateien:          42                   │
│  Nachrichten:      15                   │
│  Letzte Änderung:  05.12.2025, 21:15    │
│                                         │
└─────────────────────────────────────────┘
```

## 🎯 Hauptfunktionen

### 1. App-Einstellungen bearbeiten
- **App Name**: Ändern und speichern
- **Package Name**: Ändert automatisch package.json und app.config.js
- **Icon Picker**: Wähle ein Bild → setzt automatisch alle 4 Assets

### 2. API-Backup erstellen
1. Tippe auf "Exportieren"
2. System-Share-Dialog öffnet sich
3. Datei speichern: `k1w1-api-backup-2025-12-05-21-15-30.json`

### 3. API-Backup wiederherstellen
1. Tippe auf "Importieren"
2. Bestätige Warnung (überschreibt vorhandene Keys)
3. Wähle JSON-Datei aus
4. Keys werden geladen
5. Erfolgs-Meldung zeigt Anzahl importierter Keys

### 4. API-Keys überprüfen
- Scrolle zur "🔑 Aktive API-Keys" Sektion
- Siehst du alle konfigurierten Keys
- Der erste Key jedes Providers ist aktiv (🟢)
- Keine Maskierung → vollständige Keys sichtbar

## 🎨 Farbschema

- **Primär (Neongrün)**: `#00FF00`
  - Export-Button
  - Aktive Keys-Badge
  - Checkmarks für Assets
  
- **Warning (Orange)**: `#ffaa00`
  - Import-Button
  - Warnung-Icons

- **Hintergrund**: Dunkles Theme (`#0a0a0a`, `#121212`)
- **Border**: `#2a2a2a`
- **Text**: Weiß/Grau-Töne

## 📝 Datei-Formate

### Export-Datei (JSON)
```json
{
  "version": 1,
  "exportDate": "2025-12-05T21:15:30.123Z",
  "appVersion": "1.0.0",
  "config": {
    "version": 3,
    "selectedChatProvider": "groq",
    "selectedChatMode": "auto-groq",
    "selectedAgentProvider": "anthropic",
    "selectedAgentMode": "claude-3-5-sonnet-20241022",
    "qualityMode": "speed",
    "apiKeys": {
      "groq": ["gsk_..."],
      "gemini": ["AIza..."],
      "openai": ["sk-..."],
      "anthropic": ["sk-ant-..."],
      "huggingface": []
    }
  }
}
```

## ✅ Checkliste für Vollständigkeit

### Icon & Assets
- [x] Icon Picker funktional
- [x] Setzt icon.png
- [x] Setzt adaptive-icon.png
- [x] Setzt splash.png
- [x] Setzt favicon.png
- [x] Zeigt Status aller Assets
- [x] Preview des gewählten Icons

### API Backup
- [x] Export als Datei (nicht JSON-Schnipsel)
- [x] Import aus Datei
- [x] Validierung des Formats
- [x] Warnungen bei Überschreiben
- [x] Erfolgs-Feedback mit Details

### API Keys Anzeige
- [x] Listet alle Provider
- [x] Zeigt Anzahl Keys pro Provider
- [x] Vollständige Keys (kein Masking)
- [x] Markiert aktiven Key
- [x] Nummeriert weitere Keys
- [x] "Keine Keys" Hinweis wenn leer

### App-Einstellungen
- [x] App Name änderbar
- [x] Package Name änderbar
- [x] Speicher-Buttons funktional
- [x] Hilfetext für Package Name

### Design & UX
- [x] Konsistentes Theme
- [x] Klare Sektionen
- [x] Passende Icons
- [x] Responsive Layout
- [x] Fehlerbehandlung
- [x] Benutzer-Feedback

## 🚀 Ready for Use!

Alle Features sind implementiert und einsatzbereit.

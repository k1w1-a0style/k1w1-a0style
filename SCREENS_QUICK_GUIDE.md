# 🎯 Schnellreferenz: Code & Diagnose Screens

## 📝 CodeScreen - Neue Features

### 🔍 Suche verwenden
1. Tippe in das Suchfeld oben
2. Ergebnisse werden in Echtzeit gefiltert
3. ✕ Button zum Löschen der Suche

### 🔄 Sortierung ändern
- Tippe auf das Sortier-Icon (rechts oben)
- Wechselt zwischen: Name → Typ → Größe
- Icons zeigen aktuelle Sortierung

### 📊 Datei-Statistiken
Beim Öffnen einer Datei siehst du:
- 📄 Zeilen-Anzahl
- ✏️ Wort-Anzahl  
- 📦 Datei-Größe (B/KB/MB)

### 📋 Inhalt kopieren
1. Öffne eine Datei
2. Tippe auf Copy-Icon (📋)
3. Inhalt ist in Zwischenablage

### #️⃣ Zeilennummern
- Nur im Preview-Modus verfügbar
- Toggle mit Liste-Icon (#)
- Wird für Session gespeichert

### 💾 Speichern & Änderungen
- Gelb leuchtendes Speicher-Icon = ungespeicherte Änderungen
- Banner am unteren Rand zeigt Warnung
- Beim Zurück-Button: Warnung vor Datenverlust

---

## 🔍 DiagnosticScreen - Neue Features

### 🏥 Gesundheitsscore verstehen

**80-100 Punkte** (🟢 Grün - Ausgezeichnet)
- Projekt ist in sehr gutem Zustand
- Minimale Probleme
- Bereit für Production

**60-79 Punkte** (🟡 Orange - Gut)  
- Projekt ist grundsätzlich okay
- Einige Warnungen zu beachten
- Empfehlungen prüfen

**0-59 Punkte** (🔴 Rot - Kritisch)
- Dringende Probleme vorhanden
- Fehler müssen behoben werden
- Sicherheitsprobleme checken

### 📊 Was wird geprüft?

#### ✅ Projekt-Struktur
- App.tsx (kritisch!)
- package.json (kritisch!)
- tsconfig.json
- ESLint Config
- theme.ts
- .gitignore
- README.md
- .env.example

#### 🔐 Sicherheit
- **.env Dateien** im Code (❌ KRITISCH)
- **Hardcodierte Secrets** (passwords, API keys)
- **Wildcard Dependencies** (package.json)

#### 📦 Code-Qualität
- Leere Dateien
- Zu große Dateien (>500 Zeilen)
- Sehr große Dateien (>100KB)
- Lange Zeilen (>120 Zeichen)
- Doppelte Dateinamen

#### 📚 Dependencies
- Anzahl Dependencies
- Anzahl DevDependencies
- Fehlende npm Scripts (start, test, build)

### 🔄 Workflow

**Schritt 1: Diagnose durchführen**
```
Tippe auf "Diagnose durchführen"
↓
Warte auf Analyse (1-2 Sekunden)
↓
Ergebnisse werden angezeigt
```

**Schritt 2: Ergebnisse prüfen**
```
Health Score ansehen
↓
Kritische Fehler (rot) zuerst beheben
↓
Warnungen (orange) durchgehen
↓
Empfehlungen (blau) umsetzen
```

**Schritt 3: Teilen oder in Chat senden**
```
Option A: "An Chat senden" → KI behebt Probleme
Option B: "Report teilen" → Mit Team teilen
```

### 📤 Report exportieren

1. Führe Diagnose durch
2. Tippe auf "Report teilen"
3. Wähle Ziel (WhatsApp, Mail, etc.)
4. Formatierter Text-Report wird geteilt

**Report enthält:**
- Gesundheitsscore
- Alle Statistiken
- Struktur-Check
- Fehler & Warnungen
- Sicherheitshinweise
- Empfehlungen
- Zeitstempel

### 💬 Chat-Integration

**"An Chat senden"** erstellt Zusammenfassung:
```
🔍 Projekt-Diagnose (Health Score: 85/100)

📊 Zusammenfassung:
• 42 Dateien, 3.241 Zeilen
• 156 KB gesamt

⚠️ 2 Warnungen
💡 3 Empfehlungen

👉 KI analysiert und optimiert automatisch
```

---

## 🎨 UI-Elemente verstehen

### Icons & Bedeutung

#### CodeScreen
| Icon | Bedeutung |
|------|-----------|
| 🔍 | Suche |
| 📊 | Sortierung |
| ➕ | Neue Datei/Ordner |
| 👁️ | Preview-Modus |
| ✏️ | Edit-Modus |
| 📋 | Kopieren |
| 💾 | Speichern |
| 🗑️ | Löschen |
| #️⃣ | Zeilennummern |
| ← | Zurück |

#### DiagnosticScreen
| Icon | Status |
|------|--------|
| ✅ | Vorhanden/OK |
| ❌ | Fehlt/Kritisch |
| ⚠️ | Warnung |
| 💡 | Empfehlung |
| 🔒 | Sicherheit |
| 📊 | Statistik |
| 🏗️ | Struktur |
| 📦 | Dependencies |

### Farb-System
- 🟢 **Grün**: Alles OK, Erfolg
- 🟡 **Orange**: Warnung, Achtung
- 🔴 **Rot**: Fehler, Kritisch
- 🔵 **Blau**: Info, Empfehlung
- ⚪ **Grau**: Neutral, Inaktiv

---

## 🚀 Performance-Tipps

### CodeScreen
1. **Suche nutzen** statt scrollen bei vielen Dateien
2. **Sortiere nach Größe** um große Dateien zu finden
3. **Preview-Modus** für schnelleres Lesen
4. **Copy-Funktion** statt manuellem Markieren

### DiagnosticScreen  
1. Diagnose **vor größeren Änderungen** durchführen
2. Health Score **regelmäßig prüfen** (z.B. wöchentlich)
3. **Empfehlungen umsetzen** für bessere Code-Qualität
4. **Report teilen** mit Team für gemeinsame Reviews

---

## 🐛 Bekannte Limitierungen

### CodeScreen
- ⚠️ Sehr große Dateien (>1MB) können langsam laden
- ⚠️ Bilder werden nicht als Preview angezeigt
- ⚠️ Keine Undo/Redo Funktion (noch)

### DiagnosticScreen
- ⚠️ Keine Echtzeit-Überprüfung outdated packages
- ⚠️ Circular Dependencies werden nicht erkannt
- ⚠️ Keine Visualisierung von Import-Graphen

---

## 💡 Pro-Tipps

### CodeScreen
1. **Long Press** auf Dateien für schnelles Löschen
2. **Suche + Sortierung** kombinieren für präzise Filter
3. **Preview-Modus** spart Akku (kein Tastatur-Rendering)
4. Nutze **Breadcrumbs** für schnelle Navigation

### DiagnosticScreen
1. **Health Score < 60?** Sofort "An Chat senden"
2. **Rote Fehler** immer vor orangen Warnungen beheben
3. **Report teilen** für Code-Reviews
4. **Regelmäßige Checks** = bessere Code-Qualität

---

## 📚 Weiterführende Infos

Siehe auch:
- `SCREEN_IMPROVEMENTS_SUMMARY.md` - Technische Details
- `ANIMATION_GUIDE.md` - Animation-System
- `QUICK_REFERENCE.md` - Allgemeine App-Referenz

---

**Letzte Aktualisierung:** 8. Dezember 2025  
**Version:** 2.0

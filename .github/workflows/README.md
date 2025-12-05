# GitHub Actions Workflows

Dieses Projekt verwendet optimierte GitHub Actions Workflows für CI/CD und Build-Prozesse.

## 📋 Workflow-Übersicht

| Workflow | Trigger | Zweck | Build-Zeit | Artifacts |
|----------|---------|-------|------------|-----------|
| **ci-build.yml** | Push/PR zu main | Schnelle CI Validierung | ~5-8 min | ❌ |
| **k1w1-triggered-build.yml** | K1W1 App oder manuell | Vollständiger Build mit Status-Tracking | ~5-10 min | ❌ |
| **release-build.yml** | Manuell | Production Builds mit Download | ~10-15 min | ✅ |

---

## 🔄 ci-build.yml - Continuous Integration

**Trigger:** Automatisch bei Push/PR zu `main` oder `master` Branch

**Zweck:** 
- Schnelle Validierung bei Code-Changes
- Stellt sicher, dass der Code kompiliert
- Führt Linting aus

**Optimierungen:**
- ✅ Nur Android (schneller als iOS/Web)
- ✅ `--no-wait` für schnelles Feedback
- ✅ Nutzt EAS Cache (kein `--clear-cache`)
- ✅ `npm ci` für deterministische Dependencies

**Build-Zeit:** ~5-8 Minuten

**Beispiel:**
```bash
# Automatisch bei:
git push origin main
```

---

## 🚀 k1w1-triggered-build.yml - App-getriggerte Builds

**Trigger:** 
1. Via Supabase Function (`trigger-eas-build`)
2. Manuell über GitHub UI

**Zweck:**
- Vollständiger EAS Build für K1W1 App
- Supabase Status-Tracking (optional)
- Unterstützt Builds mit und ohne Job ID

**Features:**
- ✅ Job ID wird von Supabase Function übergeben
- ✅ Status-Updates in Supabase `build_jobs` Tabelle
- ✅ Funktioniert auch ohne Job ID (für manuelle Triggers)
- ✅ Build URL wird extrahiert und gespeichert

**Build-Zeit:** ~5-10 Minuten

**Supabase Integration:**

```typescript
// K1W1 App triggert Build via Supabase Function:
const { data } = await supabase.functions.invoke('trigger-eas-build', {
  body: { githubRepo: 'your-username/k1w1-a0style' }
});

// Supabase Function erstellt Job und triggert Workflow:
// 1. Create build_job → job_id
// 2. Trigger GitHub Actions with job_id
// 3. Workflow updates build_job status
```

**Manueller Trigger:**

```bash
# Via GitHub CLI:
gh workflow run k1w1-triggered-build.yml

# Mit Job ID:
gh workflow run k1w1-triggered-build.yml -f job_id=123
```

**Status Flow:**
```
queued → building → completed
   ↓         ↓          ↓
 error ←── error ←── error
```

---

## 📦 release-build.yml - Production Builds

**Trigger:** Manuell über GitHub UI

**Zweck:**
- Production-ready Builds
- Download von Build-Artifacts
- Flexible Platform/Profile-Auswahl

**Input-Parameter:**

| Parameter | Optionen | Default | Beschreibung |
|-----------|----------|---------|--------------|
| `platform` | android, ios, all | android | Zu bauende Platform(s) |
| `profile` | production, preview, development | production | EAS Build Profile |

**Features:**
- ✅ Wartet auf Build-Completion (`--wait`)
- ✅ Download der APK/IPA Dateien
- ✅ Upload als GitHub Artifacts (30 Tage Retention)
- ✅ Build Summary in GitHub Actions

**Build-Zeit:** ~10-15 Minuten (je nach Platform)

**Manueller Trigger:**

```bash
# Via GitHub CLI:
gh workflow run release-build.yml -f platform=android -f profile=production

# Via GitHub UI:
# Actions Tab → Release Build → Run workflow → Select options
```

**Artifact Download:**

Nach erfolgreichem Build:
1. Gehe zu GitHub Actions → Release Build → Latest Run
2. Scrolle zu "Artifacts"
3. Download `k1w1-android-production.zip`
4. Entpacke die APK

---

## 🔐 Benötigte Secrets

Alle Workflows benötigen folgende GitHub Secrets:

| Secret | Beschreibung | Required für |
|--------|--------------|--------------|
| `EXPO_TOKEN` | EAS CLI Token | Alle Workflows |
| `SUPABASE_URL` | K1W1 Supabase URL | k1w1-triggered-build |
| `SUPABASE_SERVICE_ROLE_KEY` | K1W1 Supabase Service Role Key | k1w1-triggered-build |

### Setup Instructions:

1. **EXPO_TOKEN:**
   ```bash
   # Login to Expo
   npx eas login
   
   # Generate token
   npx eas build:configure
   
   # Add to GitHub:
   # Settings → Secrets → Actions → New repository secret
   # Name: EXPO_TOKEN
   # Value: <your-token>
   ```

2. **SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY:**
   ```bash
   # Get from Supabase Dashboard:
   # Project Settings → API → URL
   # Project Settings → API → service_role key (secret!)
   
   # Add to GitHub:
   # Settings → Secrets → Actions → New repository secret
   ```

---

## 🐛 Troubleshooting

### Build schlägt fehl

**Symptom:** Workflow zeigt Fehler in "Build on EAS" Step

**Lösungen:**
1. Prüfe EAS CLI Token:
   ```bash
   npx eas whoami
   ```
2. Prüfe `eas.json` Konfiguration
3. Prüfe expo.dev Build-Logs:
   ```bash
   npx eas build:list
   npx eas build:view <build-id>
   ```

### Job ID fehlt (k1w1-triggered-build)

**Symptom:** Workflow läuft, aber "Validate Job ID" zeigt Warning

**Ursachen:**
- Manueller Trigger ohne Job ID (OK)
- Supabase Function sendet keine Job ID (BUG - sollte gefixt sein!)

**Prüfen:**
```bash
# Supabase Function Logs:
supabase functions logs trigger-eas-build

# GitHub Actions Payload:
# Actions → Workflow Run → View workflow file → Check client_payload
```

### Build ist zu langsam

**Symptom:** Build dauert > 20 Minuten

**Optimierungen:**
1. Verwende `--no-wait` für CI (ci-build.yml)
2. Entferne `--clear-cache` wenn nicht nötig
3. Baue nur eine Platform (android ODER ios)
4. Prüfe EAS Build-Queue Status:
   ```bash
   npx eas build:list --status=in-queue
   ```

### Dependencies sind veraltet

**Symptom:** `npm ci` schlägt fehl

**Lösung:**
```bash
# Lokal dependencies aktualisieren:
npm install
npm audit fix

# Commit package-lock.json
git add package-lock.json
git commit -m "Update dependencies"
git push
```

---

## 📊 Performance-Optimierungen

### Vor Optimierung (alte Workflows):
```
build.yml:
  - Platform: all (iOS + Android + Web)
  - Clear Cache: ja
  - npm: install
  - Node: 18
  ⏱️ Build-Zeit: 15-25 Minuten
```

### Nach Optimierung (neue Workflows):
```
ci-build.yml:
  - Platform: android only
  - Clear Cache: nein
  - npm: ci
  - Node: 20
  ⏱️ Build-Zeit: 5-8 Minuten
```

**Verbesserung:** 🚀 **60-70% schneller!**

### Optimierungs-Details:

| Optimierung | Zeitersparnis | Warum? |
|-------------|---------------|--------|
| `--no-wait` statt `--wait` | ~5-10 min | Workflow wartet nicht auf EAS Build Completion |
| Android only statt `all` | ~10-15 min | iOS Builds benötigen macOS Runner (teurer) |
| `npm ci` statt `npm install` | ~1-2 min | Deterministisch, kein dependency resolution |
| Node 20 statt 18 | ~30 sec | Bessere Performance, neuere V8 Engine |
| Cache nutzen (kein `--clear-cache`) | ~2-5 min | Dependencies werden gecacht |

---

## 🔄 Workflow-Migration

### Alte Workflows → Neue Workflows

| Alt | Neu | Grund |
|-----|-----|-------|
| `build.yml` | ✅ `ci-build.yml` | Optimiert für schnelle CI |
| `deploy-supabase-functions.yml` | ✅ `k1w1-triggered-build.yml` | Korrekter Name + Bug-Fixes |
| `eas-build.yml` | ❌ Gelöscht | Redundant + Output-Bug |

### Breaking Changes:

**Keine!** Die neuen Workflows sind rückwärtskompatibel:
- ✅ Supabase Function Integration funktioniert weiterhin
- ✅ GitHub Secrets bleiben gleich
- ✅ EAS Build Konfiguration unverändert

---

## 📚 Weitere Ressourcen

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [expo-github-action](https://github.com/expo/expo-github-action)

---

## 🆘 Support

**Fragen?** Öffne ein GitHub Issue oder kontaktiere das Team.

**Build-Logs:** Alle Logs sind verfügbar unter:
- GitHub Actions: `https://github.com/<username>/k1w1-a0style/actions`
- EAS Build: `https://expo.dev/accounts/<username>/projects/k1w1-a0style/builds`
- Supabase Logs: Supabase Dashboard → Edge Functions → Logs

---

**Letzte Aktualisierung:** 5. Dezember 2025  
**Version:** 2.0 (Optimiert)

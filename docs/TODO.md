# TODO – k1w1-a0style (Projektstand)

## ✅ Aktueller Stand (funktioniert / vorhanden)

- Expo/React Native App startet, Typecheck/Lint/Tests laufen durch.
- Preview-System (Supabase-Flow):
  - `save_preview` Edge Function nimmt Files + Dependencies entgegen und speichert in DB.
  - `previews` Tabelle (Migration) inkl. `secret` + `expires_at`.
  - `preview_page` Edge Function lädt Preview aus DB und rendert Web-Preview via Sandpack Client im iFrame.
  - PreviewScreen in der App:
    - Mode: Supabase Preview (Auto-Sync + manuell)
    - Mode: Web (lokale URL im WebView)
    - Manual Code Editor → Preview erstellen
- “Option B” (unhandledrejection) in `preview_page` ist drin.

---

## 🔥 Kritische Issues (solltest du als nächstes machen)

### Security / Abuse

- [ ] **save_preview ist faktisch öffentlich (anon key ist public).**
      → Entscheiden: nur logged-in Users? Rate limiting? Captcha? Token?
- [ ] Payload Limits serverseitig nochmal hart prüfen: - max files - max file size - max total size - allowed file types
- [ ] Optional: Blocklist für offensichtliche Secrets im Code (z.B. Service Role, private keys).

### Privacy

- [ ] Klären: Sandpack/CodeSandbox-Bundler kann Code extern verarbeiten (je nach Bundler-Architektur).
      → Wenn “niemals extern”, dann brauchst du eigenen Bundler-Server (Later).

### Robustheit Preview

- [ ] PreviewPage: bessere Error-Ausgabe: - “Missing dependency” / “Module not found” klar anzeigen - Button: “Reload” + “Copy error”
- [ ] PreviewScreen: Vor dem Upload Warnung anzeigen, wenn Projekt Imports enthält, die sicher im Web knallen: - expo-_, @expo/_, react-native-webview, native-only libs, etc.

### Supabase Cleanup

- [ ] Expired Previews automatisch löschen: - DB job/cron (pg_cron) oder scheduled function - zusätzlich Index auf `expires_at`
- [ ] Optional: “max previews per project” oder “per user” Begrenzung.

---

## 🧩 Verbesserungen (Quality / UX)

### PreviewScreen UX

- [ ] “Zuletzt generiert: …” + “Dateien: X / Bytes: Y” anzeigen
- [ ] Auto-Sync Toggle erklärt: “Wird nach 2.5s erstellt wenn gespeichert”
- [ ] “Open in Browser / Copy URL” Buttons auch anzeigen wenn loading

### Preview Build Logik

- [ ] buildPreviewFilesFromProject:
  - Priorität für `src/App.*` + `App.*` + `index.*` ok
  - optional: include `src/**` helpers wenn benötigt
- [ ] Dependencies:
  - auto-filter Expo/native libs clientseitig + serverseitig konsistent
  - Option: “force add react-navigation web set” wenn Navigation erkannt wird

### RN → Web Transform

- [ ] transformRNtoWeb erweitern:
  - mehr Expo Module stubs (z.B. expo-constants)
  - icons fallback besser (Text / inline svg)
  - react-native-screens / gesture-handler best-effort init
- [ ] Optional: “Unsupported features list” als Overlay im Preview

---

## 🚀 Erweiterungen (wenn Basis stabil ist)

- [ ] Preview “Share Link” mit kurzer URL (redirect endpoint)
- [ ] Preview History: letzte N Previews pro Projekt anzeigen (und löschen)
- [ ] Preview Diff: “was hat sich geändert seit letzter Preview”
- [ ] Optional: “Open in external browser” aus PreviewScreen + “copy to clipboard” sowieso

---

## 🧪 Tests / CI

- [ ] Tests für Edge Functions (happy path + invalid payload + expired preview)
- [ ] Regression Test: Migration + RLS + Service role Zugriff
- [ ] Optional: E2E smoke: create preview via curl → load preview_page → expects 200

---

## 📚 Docs

- [ ] README aktualisieren: Setup, Env, Supabase Deploy, Preview Flow
- [ ] “Known Limitations” Sektion für Web-Preview (native libs etc.)

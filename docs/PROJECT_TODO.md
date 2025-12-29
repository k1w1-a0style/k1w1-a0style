# PROJECT TODO (aktualisiert)

> Stand: 2025-12-27

## ✅ Bereits erledigt

- [x] Supabase `previews` Tabelle + Indizes + Expiry Support
- [x] `secret` **NOT NULL** + Unique Index
- [x] `cleanup_expired_previews()` Function + `service_role` grant
- [x] Edge Function `save_preview` deployed
- [x] Edge Function `preview_page` deployed (inkl. **Option B**: `unhandledrejection` + `error` listener)
- [x] `PreviewScreen` kann Preview URL laden (WebView)

## ✅ Neu implementiert (dieses Patch)

- [x] Edge Function `create_codesandbox` (CodeSandbox define API)
- [x] `PreviewScreen` hat neuen Modus **🧪 Sandbox**
- [x] `supabase/config.toml` erweitert um `functions.create_codesandbox`

## 🔥 Kritische Punkte / Bugs / Risiken

- [ ] **Security/Privacy:** CodeSandbox Previews sind öffentlich → niemals sensible Inhalte
- [ ] **Edge Function Rate Limits:** CodeSandbox API kann limitieren; Fehlerhandling UI ggf. verbessern
- [ ] **Dependency Kompatibilität:** RN/Expo Packages können Browser-Preview killen → Filter ist best-effort
- [ ] **WebView Cookies/CSP:** Einige Sandboxes/Embeds können in WebView blocken (je nach Plattform)

## 🚧 Nächste sinnvolle Schritte

### Preview-Qualität

- [ ] In `preview_page`: optionaler Toggle „raw logs“ / „runtime errors“ in UI anzeigen
- [ ] In `PreviewScreen`: bessere Anzeige von _was_ gesendet wurde (fileCount/size/skipped)
- [ ] Auto-Cleanup Job (cron) in Supabase einrichten, der `cleanup_expired_previews()` regelmäßig ausführt

### Stabilität

- [ ] Server-side Payload Limits (save_preview + create_codesandbox): harte max bytes + max files enforced
- [ ] Observability: Logs + optionales `meta.debug` speichern (nur minimal)

### UX

- [ ] „Open in external browser“ immer anbieten, wenn WebView Probleme macht
- [ ] Beim Switch der Modi: optionaler Hinweis, dass URLs/Preview getrennt sind

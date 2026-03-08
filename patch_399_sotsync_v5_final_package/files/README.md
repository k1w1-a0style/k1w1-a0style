# k1w1-a0style


## Docs & Workflow

- Einstieg: `docs/INDEX.md`
- Offene Punkte: `docs/TODO.md`
- Patch-Ablauf: `docs/WORKFLOW_PATCHING.md`
- Projekt-Roadmap (gröber): `docs/PROJECT_TODO.md`
- Patchlog (append-only): `docs/patches/PATCHLOG_ROOT.md`
- Checklog (laufend, kurz): `PROJECT_CHECKLOG.md`

- CI Lite (in-app): Globaler Header-Button **✅** triggert GitHub Actions für ESLint + TypeScript (robust mit Fallbacks). Im Modal kannst du Logs kopieren, ein **Apply Patch (JSON)** ausführen und optional **Autofix ESLint** (separater Workflow, guarded writeback). **Nach erfolgreichem Autofix** folgt automatisch ein **Chain-Run** (CI Lite) auf derselben Branch; der Header zeigt den Status über ein kleines Lämpchen.

> Hinweis: Der Name "k1w1-a0style" ist wieder der normale Projektname. Falls du irgendwo noch "-restored" siehst, ist das ein Relikt aus einem Reparatur-Zip.

React-Native/Expo App zum Bauen und Testen von Projekten/Flows mit **integriertem Preview-System**.

## Aktueller Stand / Nächste Schritte

- Letzter Stand im Repo: **Patch 399** (CI Lite workflow SoT sync + drift contract aligned).
- Vor dem nächsten Code-Patch: **Docs/TODO ist der Single Source of Truth** für alle offenen Punkte.

Wenn du Patches als ZIP einspielst:

1) ZIP ins Projektroot legen
2) `unzip -o <patch>.zip -d .`
3) Tests laufen lassen (`npm run typecheck && npm run lint:ci && npm run test:silent`)
4) Commit + Push

## Was das Preview-System kann

Du hast jetzt **drei** Preview-Modi in `PreviewScreen`:

1. **🚀 Supabase Preview (empfohlen)**
   - App schickt Projekt-Dateien an eine Supabase Edge Function (`save_preview`).
   - DB speichert ein Preview-Objekt (`previews` Tabelle) + `secret` Token.
   - `preview_page` rendert eine HTML Seite, die die Files in einem Browser-Sandbox-Runner startet (Sandpack Client).
   - Vorteil: _alles_ bleibt in deiner Supabase Infrastruktur (bis auf die Sandpack Assets via CDN), und die URLs sind über `secret` geschützt.

2. **🧪 CodeSandbox Preview (für dich / Debug / Demo)**
   - App schickt Projekt-Dateien an `create_codesandbox`.
   - Edge Function erstellt eine echte CodeSandbox über deren **define API** und gibt `embed`/`editor` URLs zurück.
   - Wichtig: **CodeSandbox Sandboxes sind öffentlich**. Also **keine sensiblen Daten**.

3. **🌐 Web (lokal)**
   - Du kannst irgendeine lokale URL laden (Metro/Expo/Vite), z.B. für schnelle Tests in der Dev-Umgebung.

## Dev Commands
Siehe `docs/DEV_COMMANDS.md` (Commands/Shortcuts, ohne rg/ripgrep).

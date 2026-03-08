# Patch 393B — Supabase deploy workflow: guarded single-function mode

## Ziel

Der bestehende Workflow `deploy-supabase-functions.yml` soll **gezielt eine einzelne Edge Function** deployen können, ohne die bestehenden Sicherungen zu verlieren.

## Warum

Der Vorschlag aus der externen Prüfung war in der Idee gut (`function_name`), hätte in der ursprünglichen Form aber Regressionen erzeugt:

- Supabase CLI wäre nicht mehr gepinnt gewesen
- `supabase login` / `supabase link` wären entfallen
- der `_shared`-Skip wäre nicht mehr abgesichert gewesen
- `deploy_all=true` hätte sich semantisch verändert

Patch 393B integriert daher nur die **sinnvolle Erweiterung**, nicht die Regressionen.

## Änderungen

### Workflow

Datei: `.github/workflows/deploy-supabase-functions.yml`

- `workflow_dispatch.inputs.function_name` ergänzt
- bestehendes `deploy_all=true` Verhalten unverändert gelassen
- neuer guarded branch für `deploy_all=false` + `function_name=<name>`
- `function_name` wird auf einfache sichere Zeichen geprüft (`[A-Za-z0-9_-]`)
- `_shared` bleibt explizit gesperrt
- fehlendes Zielverzeichnis führt zu sauberem Fehler
- CLI-Pinning, `supabase login` und `supabase link` bleiben erhalten

### Guard-Script

Datei: `scripts/check_supabase_deploy_workflow.sh`

Prüft, dass die wichtigsten Invarianten nicht versehentlich wieder verloren gehen:

- `function_name` Input vorhanden
- Supabase CLI weiter gepinnt
- Login/Link weiter vorhanden
- `_shared`-Guard vorhanden
- Single-Function-Deploy-Pfad vorhanden

### Dokumentation

Aktualisiert:

- `.github/workflows/README.md`
- `README.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`

Neu:

- `docs/patches/patch_393B.md`

## Validierung

Nach Anwenden des Patches:

```bash
bash scripts/check_supabase_deploy_workflow.sh
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Erwartetes Verhalten

### Alle Functions deployen

- `deploy_all=true`
- `function_name` wird ignoriert
- alle Unterordner in `supabase/functions/*` außer `_shared` werden deployt

### Einzelne Function deployen

- `deploy_all=false`
- `function_name=<name>`
- genau `supabase/functions/<name>` wird deployt

### Nichts deployen

- `deploy_all=false`
- `function_name` leer
- Workflow beendet sich erfolgreich ohne Deploy

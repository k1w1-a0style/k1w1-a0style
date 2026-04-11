# Agent Instructions (Deutsch, Codex/Cloud-Agent freundlich)

Du arbeitest in diesem Repo als automatisierter Coding-Agent.
Ziel: **kleine, sichere Änderungen**, reproduzierbar, mit Tests.


## Zentrale Arbeitsanweisung (verbindlich, dauerhaft)

### 1) Arbeitsweise pro Runde
- Pro Runde nur den klar abgegrenzten Scope bearbeiten.
- Keine Broad-Refactors ausserhalb des definierten Blocks.
- Kleine Nebenfunde nur direkt mitfixen, wenn sie eindeutig im selben Themenblock liegen.
- Groessere Folgearbeit nicht halb starten, sondern als **genau einen** naechsten Durchlauf empfehlen.

### 2) Teststrategie
- In Zwischenrunden nur scope-gerechte Tests und minimal noetige Checks ausfuehren.
- Nicht reflexhaft in jeder Runde die komplette Suite fahren.
- Sobald ein Themenblock in einer Runde keinen weiteren Durchlauf mehr braucht, in dieser finalen Blockrunde den vollstaendigen relevanten Abschluss-Check fahren.
- Abschluss-Check muss die fuer den Block relevante volle Test-/Check-Abdeckung sicherstellen, damit der Block belastbar gruen abgeschlossen ist.

### 3) Antwortschema / Reporting (immer vollstaendig)
Jede Runde endet im **vollstaendigen** festen Schema mit allen Punkten. Das gilt auch fuer Folge-/Weiter-Durchlaeufe.
- Keine Kurzfassung.
- Nicht auf fruehere Antwort verweisen.
- Bei Antwort "weiter" beginnt die Abschlussantwort erneut vollstaendig bei Punkt 1.

Pflichtpunkte im Abschlussbericht jeder Runde:
1. kurze Aenderungsuebersicht
2. geaenderte Dateien und warum
3. kleine Nebenfunde
4. bewusst nicht geaenderte Doku
5. ausgefuehrte Tests/Checks mit Ergebnis
6. was aus dem vorherigen Durchlauf als Folgearbeit empfohlen war
7. ob diese Folgearbeit jetzt vollstaendig / teilweise / bewusst nicht erledigt wurde
8. was offen bleibt
9. ob ein weiterer Durchlauf noetig ist (JA/NEIN + genau ein naechster Block)
10. ob der Stand in diesem Scope mergebar ist (JA/NEIN + exakter Blocker)

### 4) Doku-/SoT-Regeln
- Aktive SoT klein und wahrheitsgemaess halten.
- Keine unnoetigen Patchlog-/Checklog-/Review-/TODO-/README-Massenupdates.
- README / TODO / TESTING_GUIDE / Review nur aendern, wenn der fachliche Vertrag wirklich betroffen ist.
- Keine "freundlichere" Doku als der echte Code-/Live-Stand.
- Keine neue Doku-Drift erzeugen.

### 5) Merge-/Abschlusslogik
- Nicht "mergebar" behaupten, wenn im Scope noch rote Checks, offene Pflichtpunkte oder neue Doku-Drift bestehen.
- Wenn ein weiterer Durchlauf empfohlen wird, muss der naechste Durchlauf wieder denselben vollstaendigen Reporting-Vertrag einhalten.

## Goldene Regeln

1. **Arbeite in kleinen Commits**: erst minimale Änderung → Tests → dann nächste.
2. **Keine Überraschungen**: keine Dependencies updaten, keine Format-Wipes ohne Grund.
3. **Checks gestuft fahren**: Zwischenrunden nur scope-gerechte Checks; in der finalen Blockrunde die volle relevante Check-Abdeckung gruen abschliessen.
4. **Security & Secrets**: niemals Tokens/Keys loggen oder in Dateien schreiben.
5. **Erkläre kurz**: Was geändert, warum, wie testen.

## Standard-Workflow

1. Code lesen & Kontext verstehen (`docs/PROJECT_CONTEXT.md`, `docs/SYSTEM_README.md`).
2. Änderung umsetzen.
3. Checks gestuft laufen lassen:

Zwischenrunde (mindestens):
```bash
npm run typecheck
npm run lint:ci
# plus gezielte betroffene Tests
```

Finale Runde eines Themenblocks (kein weiterer Durchlauf noetig):
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
# plus relevante Abschluss-Checks fuer den Block
```

## Patch-Artifact Workflow (kanonisch)

Wir liefern Änderungen als **`.patch`-Datei in einer ZIP** aus, damit sie im Projekt-Root
per `git apply` geprüft und angewendet werden können.

- ZIP-Name: `k1w1-a0style_patch_<PATCHNUM>.zip`
- Inhalt:
  - `k1w1-patch-<PATCHNUM>-<slug>.patch`
  - `docs/patches/patch_<PATCHNUM>.md` (oder gleichnamige Notiz im Paket)
  - kurze `README.md`
- Anwendung:

```bash
unzip k1w1-a0style_patch_<PATCHNUM>.zip -d k1w1-patch-<PATCHNUM>
git apply --check k1w1-patch-<PATCHNUM>/**/*.patch
git apply k1w1-patch-<PATCHNUM>/**/*.patch
rm -rf k1w1-patch-<PATCHNUM>
npm run typecheck
npm run lint:ci
npm run test:silent
git add -A
git commit -m "Patch <PATCHNUM>: <kurzer Titel>"
git push origin codex
```

Vor Auslieferung eines Patch-Artefakts (entspricht finaler Blockrunde):
- `git apply --check` muss lokal erfolgreich sein
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_artifact.sh <patchfile>`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_eas_manual_trigger_controls.sh`
- `bash scripts/check_eas_production_credentials.sh`
- `bash scripts/check_eas_strict_lockfile_policy.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_k1w1_handler_providers.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_supabase_deploy_workflow.sh`
- `npm run test:silent -- --runInBand edgeHelperVisibility.invariants.test.ts`
- `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts`

Jeder Patch dokumentiert mindestens:
- `docs/patches/patch_<PATCHNUM>.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`

Kern-MDs (`README.md`, `docs/TODO.md`, `docs/INDEX.md`, `docs/TESTING_GUIDE.md`, `docs/FRESH_CHECKOUT_GREEN_PATH.md` sowie betroffene Review-/Status-MDs) werden **nicht nur ggf.**, sondern vor Abschluss immer aktiv auf Drift geprueft und bei Bedarf synchronisiert.

## Verbindlicher Doku-/SoT-Abgleich vor Abschluss

Vor Abschluss **immer aktiv gegenprüfen** (kein „ggf.“) bei:
- `README.md`
- `docs/TODO.md`
- `docs/INDEX.md`
- `docs/TESTING_GUIDE.md`
- `docs/FRESH_CHECKOUT_GREEN_PATH.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- betroffene `docs/reviews/*.md` / Status-MDs im Patch-Scope

Pflicht dabei:
1. Patch-/Stand-Header konsistent?
2. offene vs. geschlossene Punkte konsistent?
3. README/TODO/INDEX/Patchlog/Checklog/Review ohne Widerspruch?

Pflicht im Abschlussbericht:
- welche MD-Dateien geprüft wurden,
- welche geändert wurden,
- welche bewusst unverändert blieben,
- kurze Begründung pro unverändertem Kern-MD.

## Cleanup

- Backup-/Rest-Dateien (z.B. `*.bak*`, `*.orig`, `*.rej`, `*~`) nicht im Repo lassen – bei Bedarf entfernen.

## UI Style-Konventionen

- **Neon Giftgrün + Dark** als Default-Look (`theme.palette.primary` als Akzent)
- **SEHR WICHTIG: Selection-Feedback überall**
  - Ausgewähltes **Repo/Branch/Profile** muss *überall* übernommen werden (Single Source: `projectData.linked*`).
  - Listen/Buttons zeigen **Glow/Rand/Lamp** für ausgewählte Items (kein Rätselraten).
- **Status-Lämpchen**: grau = unknown/waiting, grün = OK, rot = Error, pulsierend = running
- **Running-Feedback**: dezente Animation (Pulse/3-Punkte/Spinner), nicht zu noisy

## Qualität

- Halte Funktionen klein.
- Bevorzugt pure Functions in `lib/` und helper in `utils/`.
- UI: konsistente Styles (siehe `styles/`).

## Wenn etwas unklar ist

- Erst Code + Docs durchsuchen.
- Dann eine Hypothese formulieren und minimal testen.
## Live Edge Secrets
For live edge contract checks, the repository uses these GitHub Actions secret names:
- EDGE_BASE_URL
- EDGE_OPERATOR_JWT
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ANON_KEY

Important:
- Never commit secret VALUES.
- Workflows/scripts must map these names explicitly into env.
- Local shell scripts cannot read GitHub secret values automatically.
- If EDGE_OPERATOR_JWT is missing, live-check scripts may fall back to SUPABASE_SERVICE_ROLE_KEY when supported.

# Operator Execution Checklist (extern / Live-Staging)

Stand: **2026-04-09 (Patch 770, ResidualRestblockFinalization + LiveContractTruthSync)**

Ziel: Eine kurze, abhakbare Ausfuehrungsliste fuer externe Operator-Schritte, damit Live-/Staging-Verifikation reproduzierbar bleibt.

> Scope: **externes Setup + Live-/Staging-Verifikation**. Kein Repo-Codefix.

## 0) Vorab

- [ ] Zielprojekt/Workspace ist korrekt ausgewaehlt.
- [ ] Zugriff auf Supabase Dashboard ist vorhanden.
- [ ] Zugriff auf GitHub Repo/Actions ist vorhanden.
- [ ] Lokale Shell ist im Projekt-Root.

## 1) `build_admin`-Provisioning

- [ ] Supabase `Authentication -> Users` oeffnen.
- [ ] Zieluser auswaehlen.
- [ ] Rolle projektkonsistent in App-Metadata setzen: `raw_app_meta_data`/`app_metadata.role = build_admin` (nicht primaer ueber `user_metadata`).
- [ ] User neu anmelden, damit ein frischer JWT mit Claim gezogen wird.

## 2) Secrets/Keys gegenpruefen (Dashboard + lokal)

- [ ] Workflow-/Build-Pfade: `K1W1_EDGE_WORKFLOW_ADMIN_KEY` vorhanden.
- [ ] Keystore-Export-Pfade: `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY` vorhanden.
- [ ] Kein produktiver Rueckfall auf alten `K1W1_EDGE_ADMIN_KEY` als Hauptpfad.

## 3) Repo-interner Preflight (muss gruen sein)

```bash
npm run docs:lint
npm run typecheck:strict
npm run verify:release
```

Erwartung ohne Live-ENV:
- Live-Edge-Readiness darf als `SKIP` erscheinen, Rest bleibt gruen.

## 4) Live-/Staging-Verifikation (read-only)

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" \
EDGE_OPERATOR_JWT="<extern provisionierter build_admin jwt>" \
npm run verify:release
```

Optional isoliert:

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" \
EDGE_OPERATOR_JWT="<extern provisionierter build_admin jwt>" \
npm run edge:check:live
# umfasst jetzt auch save_preview-Transport-Contract (fragment/header, kein ?secret=)
```

Sichere Variablenquelle:
- Runner/CI: `EDGE_BASE_URL` und `EDGE_OPERATOR_JWT` als masked secrets injizieren.
- Lokaler URL-Fallback: Projekt-Ref `xfgnzpcljsuqqdjlxgul` => `https://xfgnzpcljsuqqdjlxgul.supabase.co/functions/v1`.
- JWT lokal nur kurzlebig nutzen; fuer dauerhafte technische Checks bevorzugt serverseitigen Secret-Weg als Runner-Secret.
- Fuer interaktive `k1w1-handler`-Liveverifikation den frischen usergebundenen `build_admin`-JWT verwenden; `service_role` bleibt ein separater technischer Server-Caller-Pfad und ist hier kein gleichwertiger Ersatz.

## 5) Erwartete Resultate

- [ ] `verify:release` zeigt fuer vollständiges Sign-off `OK_FULL`; `OK_WITH_SKIPS` ist nur partial/local evidence und **kein** Voll-Sign-off.
- [ ] Live-Checks laufen nicht mehr im SKIP-Pfad (ENV gesetzt).
- [ ] Read-only Vertragsantworten entsprechen Runbook-Erwartung.
- [ ] Bei Preview-Vertrag: kein Legacy-`?secret=`-Response mehr; bei Drift `preview_page`/`save_preview` gezielt redeployen.
- [ ] `verify_jwt` fuer `save_preview` und `k1w1-handler` im Zielprojekt aktiv bestaetigt (`true`).

## 6) Troubleshooting (schnell)

- `401 unauthorized` -> JWT neu ziehen / neu anmelden.
- `403 role not allowed` -> Claim `build_admin` fehlt/falsch.
- `500` auf Operator-Route -> Edge-Env/Secrets/Logs pruefen.
- Live-SKIP trotz Setup -> `EDGE_BASE_URL`/`EDGE_OPERATOR_JWT` in aktueller Shell wirklich gesetzt?

## 7) Abschluss / Hand-off

- [ ] Datum + Operator + Zielumgebung dokumentiert.
- [ ] Ergebnis (`gruen` / `blockiert`) kurz notiert.
- [ ] Bei Blockern: Fehlercode + betroffene Route + naechster Schritt notiert.

# Operator Setup Checklist (`build_admin`)

Stand: **2026-04-02 (Docs Konsolidierung)**

Ziel: Ein neuer Operator soll ohne Raten vom Login bis zum read-only Live-Vertragscheck kommen.

## 1) Voraussetzungen
- Zugriff auf das Supabase Dashboard des Zielprojekts.
- Lokale App-/Testumgebung mit gesetztem scoped Admin-Key.
- Ein normaler Login allein reicht **nicht**; fuer Operator-Pfade ist ein extern provisionierter `build_admin`-Claim Pflicht.

## 2) Supabase User vorbereiten
1. Supabase Dashboard oeffnen.
2. `Authentication` -> `Users` -> Zieluser waehlen.
3. In den User-Metadaten den Claim setzen:

```json
{
  "role": "build_admin"
}
```

oder alternativ in `app_metadata`:

```json
{
  "app_metadata": {
    "role": "build_admin"
  }
}
```

Wichtig:
- Kein Mischmasch aus mehreren Rollenwerten.
- Nach der Aenderung den User neu anmelden, damit ein frischer JWT gezogen wird.

## 3) Lokale Secrets / Keys pruefen
- Workflow-/Build-/Artifact-Pfade: `K1W1_EDGE_WORKFLOW_ADMIN_KEY`
- Optionaler lokaler Helfer fuer Secret-Rotation/Initialisierung: `bash scripts/signing_secrets.sh --rotate`
- Keystore-Export: `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`
- Legacy `K1W1_EDGE_ADMIN_KEY` nicht als produktive Hauptloesung verwenden.

## 4) Minimaler Preflight
```bash
npm run docs:lint
npm run typecheck:strict
npm run verify:release
```

Wenn die Live-Checks gegen eine echte Umgebung laufen sollen:

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin jwt>" npm run verify:release
```


Der read-only Teil laesst sich bei Bedarf auch isoliert starten:

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" \
EDGE_OPERATOR_JWT="<extern provisionierter build_admin jwt>" \
npm run edge:check:live
```

## 5) Erwartetes Verhalten beim Live-Check
- `k1w1-handler` mit absichtlich kaputtem JSON -> `400 invalid_request_payload`
- `preview_page` mit bewusst falschem `secret` -> `404 Preview not found`

Wenn stattdessen `401`/`403` kommt:
- JWT neu ziehen
- Claim im Supabase Dashboard pruefen
- nicht sofort den Repo-Code anfassen

## 6) Typische Fehlerbilder
| Symptom | Wahrscheinliche Ursache | Naechster Schritt |
|---|---|---|
| `401 unauthorized` | JWT abgelaufen / falscher User | Neu anmelden, JWT erneuern |
| `403 role not allowed` | `build_admin` fehlt extern | User-Metadata korrigieren |
| `500` in Operator-Route | Edge-Umgebung / Secrets / Durable-Store Problem | `verify:release` + Edge-Logs pruefen |
| Live-Check wird geskippt | `EDGE_BASE_URL` oder `EDGE_OPERATOR_JWT` fehlt | Env setzen und erneut laufen lassen |

## 7) Done-Kriterium
- User hat frischen JWT mit `build_admin`
- `npm run verify:release` ist gruen
- read-only Live-Contracts antworten wie erwartet
- erst danach echte Operator-Flows (Dispatch / Build / Logs / Keystore) testen

# Edge Function Caller Audit — k1w1-handler / save_preview

Stand: **2026-04-03**

## Scope

Repo-Trace fuer:
- alle erkennbaren Caller von `k1w1-handler`
- alle erkennbaren Caller von `save_preview`
- Auth-/Header-Aufbau in App, Scripts und Edge-Guards
- relevante SoT-Doku im aktuellen Stand

Explizit **nicht** Teil dieses Durchlaufs:
- kein Deploy
- keine Supabase-Live-Mutation
- kein `db push`

## Caller-Inventar (Repo)

| Caller-Datei | Function | Repo-Auth beim Call | Typ | Produktionsrelevant | Drift-Risiko |
|---|---|---|---|---|---|
| `lib/orchestrator/k1w1Edge.ts` | `k1w1-handler` | setzt `Authorization: Bearer <supabase session jwt>`; kein `x-k1w1-admin-key` | Bearer JWT | Ja (AI-Orchestrator Runtime) | **Hoch**, solange live `verify_jwt=false` + Admin-Key-Contract aktiv bleibt |
| `hooks/previewHelpers.ts` (`invokeSavePreview`) | `save_preview` | setzt `Authorization: Bearer <user jwt>`; kein `x-k1w1-admin-key` | Bearer JWT | Ja (Remote-Preview Runtime) | Niedrig, wenn live `verify_jwt=true` bestaetigt |
| `scripts/check_edge_live_contracts.sh` | `k1w1-handler` | setzt `Authorization: Bearer $EDGE_OPERATOR_JWT` fuer den Contract-Test | Bearer JWT (Test) | Nein (Operator-Check) | Mittel (nur wenn falscher JWT/Role genutzt wird) |
| `scripts/check_workflow_edge_contracts.sh` | beide (statisch) | erzwingt im Repo `requireAiOperatorJwtRole(...)` fuer `k1w1-handler`, `requireVerifiedJwt(...)` fuer `save_preview`, und verbietet `x-k1w1-admin-key` in beiden Entry-Points | statischer Vertrags-Check | Indirekt | Niedrig fuer Repo-Drift; kein Live-Beweis |

## Bewertete Auth-Lage

### k1w1-handler

**Repo-Vertrag:**
- `supabase/config.toml`: `verify_jwt = true` fuer `k1w1-handler`.
- Function-Guard: `requireAiOperatorJwtRole(req, "k1w1-handler")` (Rolle `service_role|build_admin`).
- Kein scoped/generischer Admin-Key-Guard im Handler-Entry.

**Caller-Vertrag im Repo:**
- App-Caller (`invokeK1w1Handler`) sendet nur Bearer-JWT.
- Kein produktiver Caller im Repo sendet fuer `k1w1-handler` zusaetzlich `x-k1w1-admin-key`.

**Schluss:**
- Repo zeigt eine **abgeschlossene JWT-Caller-Migration** fuer `k1w1-handler`.
- Wenn live weiterhin `verify_jwt=false` + Admin-Key/scoped-auth genutzt wird, ist das ein **Live-Drift-/Deploy-Risiko**, nicht ein offener Repo-Caller-Restpunkt.

### save_preview

**Repo-Vertrag:**
- `supabase/config.toml`: `verify_jwt = true` fuer `save_preview`.
- Function-Guard: `requireVerifiedJwt(req, "save_preview")`.
- Kein `requireScopedEdgeAuth`, kein `x-k1w1-admin-key`-Pfad.

**Caller-Vertrag im Repo:**
- Preview-Caller sendet Bearer-JWT aus `supabase.auth.getSession()`.

**Schluss:**
- Repo-Caller und Repo-Function sind konsistent JWT-basiert.
- Bei bereits bestaetigtem Live-Status `verify_jwt=true` ist ein Deploy primär Paritaetspflege, kein zwingender Sicherheitsgewinn.

## Deploy-Entscheidungsvorlage

### k1w1-handler

**Jetzt deploybar:** **nur unter Bedingungen**.

Vor einem sicheren Deploy extern klaeren:
1. Welche konkreten Live-Caller nutzen heute `x-k1w1-admin-key`/`requireScopedEdgeAuth`-Vertrag?
2. Koennen diese Caller gleichzeitig auf Bearer-JWT + Rolle `build_admin|service_role` migriert werden?
3. Gibt es Runbook-/Rollback-Fenster fuer sofortige Caller-Fixes, falls 401/403 nach Deploy auftreten?

Ohne diese Klaerung: hohes Break-Risiko fuer bestehende Live-Caller.

### save_preview

**Jetzt deploybar:** **optional**.

Begruendung:
- Repo- und Live-Auth-Modell sind laut vorliegendem Befund bereits aligned (`verify_jwt=true`, JWT-Caller).
- Erwartbarer Effekt ist Code-/Paritaetsnachzug, nicht ein neuer Sicherheitsgewinn durch Auth-Contract-Wechsel.

## Offene externe Klaerungen

- Inventar der **externen** (nicht im Repo sichtbaren) `k1w1-handler`-Caller.
- Verfuegbarkeit/Provisioning eines passenden Operator-JWT-Contracts (`build_admin|service_role`) fuer diese Caller.
- Betriebsentscheidung fuer Migrationsstrategie (big-bang vs. dual-run/compat-phase via separater Route/Version).

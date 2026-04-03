# Edge Function Caller Audit — k1w1-handler / save_preview

Stand: **2026-04-03 (Patch 740 SoT-Konsolidierung nach bestaetigtem Live-Check)**

## Scope

Repo-Trace fuer:
- alle erkennbaren Caller von `k1w1-handler`
- alle erkennbaren Caller von `save_preview`
- Auth-/Header-Aufbau in App, Scripts und Edge-Guards
- SoT-Abgleich nach bestaetigtem externem read-only Live-Check

Explizit **nicht** Teil dieses Durchlaufs:
- kein Deploy
- keine Supabase-Live-Mutation
- kein `db push`

## Caller-Inventar (Repo)

| Caller-Datei | Function | Repo-Auth beim Call | Typ | Produktionsrelevant | Status |
|---|---|---|---|---|---|
| `lib/orchestrator/k1w1Edge.ts` | `k1w1-handler` | setzt `Authorization: Bearer <supabase session jwt>`; kein `x-k1w1-admin-key` | Bearer JWT | Ja (AI-Orchestrator Runtime) | JWT-Caller-Contract konsistent |
| `hooks/previewHelpers.ts` (`invokeSavePreview`) | `save_preview` | setzt `Authorization: Bearer <user jwt>`; kein `x-k1w1-admin-key` | Bearer JWT | Ja (Remote-Preview Runtime) | JWT-Caller-Contract konsistent |
| `scripts/check_edge_live_contracts.sh` | `k1w1-handler` | setzt `Authorization: Bearer $EDGE_OPERATOR_JWT` fuer den Contract-Test | Bearer JWT (Test) | Nein (Operator-Check) | read-only Verifikation |
| `scripts/check_workflow_edge_contracts.sh` | beide (statisch) | erzwingt im Repo `requireAiOperatorJwtRole(...)` fuer `k1w1-handler`, `requireVerifiedJwt(...)` fuer `save_preview`, und verbietet `x-k1w1-admin-key` in beiden Entry-Points | statischer Vertrags-Check | Indirekt | Repo-Drift-Guard |

## Bestaetigter Live-Nachtrag (extern, read-only)

Fuer `k1w1-handler` wurde extern bestaetigt:
- mit gueltigem Bearer-JWT: Auth wird passiert, Fehler erst fachlich als `400 invalid_request_payload`
- ohne Token: `401 Unauthorized`

## Abschlussbewertung

### k1w1-handler

- JWT-/Rollenpfad ist live wirksam.
- fail-closed Verhalten ist live bestaetigt.
- Der zuvor kritische Auth-Migrationspunkt gilt damit als abgeschlossen.

### save_preview

- Bleibt live/repo-konsistent auf JWT-Basis.
- Kein neuer kritischer Auth-Restpunkt.

### Bewusst offen (nicht Teil dieses Abschlusses)

- `diagnostics_reports` bleibt offene Produktentscheidung (A/B), kein Blindumbau.
- Optionale spaetere Hygiene-/Cleanup-Themen bleiben separat gefuehrt.

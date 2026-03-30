# Patch 623 - UTF-8-RBAC-Regressionstest belastbar gegen Legacy-Decoder gemacht

## Kontext
Patch 622 hat den serverseitigen UTF-8-Decoderfix in `_shared/auth.ts` korrekt umgesetzt.  
PR-Review war jedoch berechtigt: der neue Regressionstest bewies den Fix noch nicht hart genug.

## Review-Fund (Root-Cause im Test)
- Der bisherige Non-ASCII-Wert lag nur in `user_metadata.display_name`.
- Die fuer den Rollenvertrag relevanten Claims (`role`, `app_metadata.role`) blieben ASCII (`build_admin`).
- Dadurch konnte der alte Decoderpfad (`atob` + direktes `JSON.parse`) in der Praxis weiterhin gruen bleiben.

## Test-Nachschaerfung
- In `__tests__/auth.failClosedAndDurableRateLimit.test.ts` wird fuer den UTF-8-Fall jetzt bewusst ein Unicode-Rollenclaim verwendet:
  - `role = "build_ädmin"`
  - `app_metadata.role = "build_ädmin"`
- Der Test prueft zwei Dinge im echten Shared-Auth-/JWT-Pfad:
  1. `getJwtPayload(req)?.role` entspricht exakt dem Unicode-Claim.
  2. `requireJwtRole(... allowedRoles: ["service_role", "build_ädmin"])` akzeptiert den Request.

## Warum das jetzt wirklich zwischen alt/neu unterscheidet
- **Legacy-Decoder (`atob` + direktes Parse):** Unicode-Rollenclaim wird typischerweise als Mojibake gelesen (`build_Ã¤dmin`) → Allowlist-Mismatch → Test rot.
- **Aktueller UTF-8-Decoder (`TextDecoder`):** Unicode-Rollenclaim bleibt korrekt (`build_ädmin`) → Allowlist-Match korrekt → Test gruen.

## Scope
- Kein Produktcode geaendert.
- Keine Runtime-/Architektur-Aenderung.
- Nur Regressionstest und Patchtracking auf naechste Patch-ID synchronisiert.

## Verifikation
- `npm run test:silent -- --runInBand __tests__/auth.failClosedAndDurableRateLimit.test.ts`
- `npm run edge:check`
- `bash scripts/check_workflow_edge_contracts.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

export const OPERATOR_REQUIRED_ROLE_NOTE =
  "Erforderlich ist JWT role=build_admin (oder service_role fuer Server-Caller).";
export const OPERATOR_EXTERNAL_PROVISIONING_NOTE =
  "build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben.";
export const OPERATOR_FAIL_CLOSED_NOTE =
  "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.";
export const OPERATOR_SERVER_AUTH_NOTE =
  "Maßgeblich bleibt die serverseitige/edge-seitige Autorisierungsprüfung.";
export const OPERATOR_CLIENT_DECODE_ONLY_NOTE =
  "Der Client liest JWT-Claims hier nur decode-only aus der Payload (ohne Signaturprüfung).";

export function buildOperatorPrecheckMessage(params: {
  action: string;
  reason:
    | "missing_jwt"
    | "invalid_role";
}): string {
  const { action, reason } = params;
  if (reason === "missing_jwt") {
    return `${action} blockiert: clientseitiger JWT-Precheck nicht erfüllt, weil lokal kein Supabase-Session-JWT vorliegt. ${OPERATOR_REQUIRED_ROLE_NOTE} ${OPERATOR_EXTERNAL_PROVISIONING_NOTE} ${OPERATOR_FAIL_CLOSED_NOTE} ${OPERATOR_CLIENT_DECODE_ONLY_NOTE} ${OPERATOR_SERVER_AUTH_NOTE}`;
  }
  return `${action} blockiert: clientseitiger JWT-Payload-Preflight nicht erfüllt (erwartet role=build_admin oder service_role). ${OPERATOR_REQUIRED_ROLE_NOTE} ${OPERATOR_EXTERNAL_PROVISIONING_NOTE} ${OPERATOR_FAIL_CLOSED_NOTE} ${OPERATOR_CLIENT_DECODE_ONLY_NOTE} ${OPERATOR_SERVER_AUTH_NOTE}`;
}

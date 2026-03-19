// UI nennt es "dev" – Backend erwartet "development".
export type UiModeId = "dev" | "preview" | "production";
export type ApiModeId = "development" | "preview" | "production";

export type WizardCredentialState =
  | "verified"
  | "missing"
  | "unknown"
  | "auth_error"
  | "stale"
  | "generated_pending_verification";

export type StatusResult = {
  exists: boolean;
  credentialState?: WizardCredentialState;
  stateDetail?: string;
  // NOTE: Backend-Response wurde geändert. Wir unterstützen beides (neu + legacy),
  // damit die App auch nach Edge-Deploys stabil bleibt.
  record?: {
    repo?: string;
    // Backend liefert z.B. "development"; UI arbeitet mit "dev".
    mode?: UiModeId | ApiModeId;
    alias?: string;
    // legacy
    storage_bucket?: string;
    storage_path?: string;
    updated_at?: string;
    created_at?: string;
    // new
    updatedAt?: string;
    storage?: {
      bucket?: string;
      path?: string;
      exists?: boolean;
    };
  };
};

export type WizardHttpDebug = {
  url: string;
  method?: string;
  ms?: number;
  status?: number;
  statusText?: string;
  bodyText: string;
};

export type ModeDef = { id: UiModeId; label: string; hint: string };

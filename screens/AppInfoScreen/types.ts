// NOTE: This file exists only to share types/constants across the AppInfoScreen slice.

export const TEMPLATE_INFO = {
  name: "Expo SDK 54 Basis",
  version: "1.0.0",
  sdkVersion: "54.0.18",
  rnVersion: "0.81.4",
} as const;

// Voll-Backup (ALLE Tokens/Keys + AI Config + Connections + GitHub Auswahl)
// ⚠️ Enthält SECRETS im Klartext. Datei nur sicher speichern!
export type FullBackupV1 = {
  type: "k1w1-full-backup";
  version: 1;
  exportDate: string;
  appVersion: string;
  aiConfig: any;
  connections: {
    supabaseRaw: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey: string;
    easProjectId: string;
  };
  tokens: {
    githubToken: string | null;
    expoToken: string | null;
    edgeAdminKey: string | null;
    /** aka SUPABASE_SERVICE_ROLE_KEY (stored in SecureStore) */
    supabaseServiceRoleKey?: string | null;
    /** optional, used by signing edge functions */
    signingMasterKey?: string | null;
  };
  /** Convenience map of CI/Repo secret names (e.g. EXPO_TOKEN) to values.
   *  Helps when migrating to a new device without hunting everything down.
   */
  ciSecrets?: Record<string, string>;
  github: {
    activeRepo: string | null;
    activeBranch: string | null;
    recentRepos: string[];
  };
};

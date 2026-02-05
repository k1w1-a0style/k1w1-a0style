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
  };
  github: {
    activeRepo: string | null;
    activeBranch: string | null;
    recentRepos: string[];
  };
};

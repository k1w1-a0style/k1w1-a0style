// screens/ConnectionsScreen/hooks/connectionTypes.ts
// Extracted from useConnectionsScreen.ts: return type definition.

export type ConnectionState = {
  busy: boolean;
  githubConnected: boolean;
  isEasInitRunning: boolean;
  activeRepo: string;
  githubOk: boolean;
  githubUser: string;
  githubScopes: string;
  supabaseOk: boolean;
  expoOk: boolean;
  expoUser: string;
  repoOk: boolean;
  repoOkLine: string;
  supabaseRef: string;
  easOk: boolean;
};

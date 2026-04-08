import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 410B client service-role containment invariants", () => {
  it("removes service-role helpers from the client token store", () => {
    const src = read("infra/github/tokenStore.ts");
    expect(src).not.toContain("getSupabaseServiceRoleKey");
    expect(src).not.toContain("saveSupabaseServiceRoleKey");
    expect(src).not.toContain("deleteSupabaseServiceRoleKey");
    expect(src).not.toContain("supabase_service_role_key_v1");
  });

  it("does not sync SUPABASE_SERVICE_ROLE_KEY from the app into repo secrets", () => {
    const src = read("lib/autoSyncRepoSecrets.ts");
    expect(src).not.toContain("getSupabaseServiceRoleKey");
    expect(src).not.toContain("saveSupabaseServiceRoleKey");
    expect(src).not.toContain("supabaseServiceRole");
    expect(src).toContain("SUPABASE_SERVICE_ROLE_KEY (manual-only, not synced from app)");
  });

  it("removes service-role input handling from the Connections screen", () => {
    const card = read("screens/ConnectionsScreen/components/SupabaseCard.tsx");
    const hook = read("screens/ConnectionsScreen/hooks/useConnectionsScreen.ts");
    const screen = read("screens/ConnectionsScreen/index.tsx");
    expect(card).not.toContain("Supabase Service Role Key");
    expect(hook).not.toContain("supabaseServiceRoleKey");
    expect(hook).not.toContain("showSupabaseServiceRole");
    expect(screen).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(screen).not.toContain("onToggleShowSupabaseServiceRole");
  });

  it("keeps full-backup/import free of client-side service-role handling", () => {
    const appInfo = read("screens/AppInfoScreen/hooks/useAppInfoScreen.ts");
    const secureFlow = read("screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow.ts");
    const storageKeys = read("lib/storageKeys.ts");
    const types = read("screens/AppInfoScreen/types.ts");
    expect(appInfo).not.toContain("getSupabaseServiceRoleKey");
    expect(appInfo).not.toContain("saveSupabaseServiceRoleKey");
    expect(appInfo).not.toContain("deleteSupabaseServiceRoleKey");
    expect(secureFlow).toContain("legacyClientServiceRoleStorageKeys");
    expect(appInfo).not.toContain("STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY");
    expect(storageKeys).toContain("legacyClientServiceRoleStorageKeys");
    expect(storageKeys).not.toContain("SUPABASE_SERVICE_ROLE_KEY:");
    expect(types).not.toContain("supabaseServiceRoleKey");
  });
});

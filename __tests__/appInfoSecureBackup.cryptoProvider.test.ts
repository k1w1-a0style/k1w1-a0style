import { resolveSecureBackupCryptoProvider } from "../lib/appInfoScopedBackup.cryptoProvider";
import { createSecretBackupPayload, decryptScopedBackup, encryptScopedBackup } from "../lib/appInfoScopedBackup";

describe("secure backup crypto provider", () => {
  const originalCrypto = global.crypto;
  afterEach(() => {
    Object.defineProperty(global, "crypto", { value: originalCrypto, configurable: true });
  });

  test("uses webcrypto provider when subtle is available", async () => {
    Object.defineProperty(global, "crypto", { value: require("crypto").webcrypto, configurable: true });
    const provider = await resolveSecureBackupCryptoProvider();
    expect(provider?.profile).toBe("webcrypto");
  });

  test("uses noble-js provider when subtle is unavailable", async () => {
    Object.defineProperty(global, "crypto", { value: { getRandomValues: require("crypto").webcrypto.getRandomValues.bind(require("crypto").webcrypto) }, configurable: true });
    const provider = await resolveSecureBackupCryptoProvider();
    expect(provider?.profile).toBe("noble-js");
  });

  test("roundtrip still works without subtle", async () => {
    Object.defineProperty(global, "crypto", { value: { getRandomValues: require("crypto").webcrypto.getRandomValues.bind(require("crypto").webcrypto) }, configurable: true });
    const payload = createSecretBackupPayload({
      connections: { supabaseRaw: "r", supabaseUrl: "u", supabaseAnonKey: "a", easProjectId: "e" },
      tokens: { githubToken: "g", expoToken: "e", workflowAdminKey: "w", androidKeystoreExportAdminKey: "k", legacyEdgeAdminKey: null, signingAdminKey: "s", signingMasterKey: "m" },
      ciSecrets: {},
      github: { linkedRepo: null, linkedBranch: null, recentRepos: [] },
    });
    const encrypted = await encryptScopedBackup({ scope: "secrets", passphrase: "correct-horse", appVersion: "1.0.0", payload });
    const decrypted = await decryptScopedBackup({ passphrase: "correct-horse", backup: encrypted });
    expect(decrypted.kind).toBe("secret-snapshot");
  });
});

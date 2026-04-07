import {
  buildPreviewSecretCandidates,
  deleteByPreviewSecretCandidates,
  findFirstByPreviewSecretCandidates,
  isValidPreviewSecretFormat,
} from "../supabase/functions/preview_page/helpers";

describe("preview secret candidate runtime contract", () => {
  it("keeps hash-only lookup candidates", async () => {
    const candidates = await buildPreviewSecretCandidates("legacy-secret");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatch(/^psh_v1_/);
  });

  it("findFirstByPreviewSecretCandidates resolves via hash-first lookup for new rows", async () => {
    const calls: string[] = [];
    const result = await findFirstByPreviewSecretCandidates("new-secret", async (candidate) => {
      calls.push(candidate);
      return candidate.startsWith("psh_v1_") ? { id: "hashed-row" } : null;
    });

    expect(result).toEqual({ id: "hashed-row" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^psh_v1_/);
  });

  it("findFirstByPreviewSecretCandidates does not use raw-secret fallback anymore", async () => {
    const calls: string[] = [];
    const result = await findFirstByPreviewSecretCandidates("legacy-secret", async (candidate) => {
      calls.push(candidate);
      return candidate === "legacy-secret" ? { id: "legacy-row" } : null;
    });

    expect(result).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^psh_v1_/);
  });

  it("deleteByPreviewSecretCandidates attempts deletion only for hash candidates", async () => {
    const calls: string[] = [];
    await deleteByPreviewSecretCandidates("cleanup-secret", async (candidate) => {
      calls.push(candidate);
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^psh_v1_/);
  });

  it("enforces preview secret format fail-closed for missing/invalid cases", () => {
    expect(isValidPreviewSecretFormat("")).toBe(false);
    expect(isValidPreviewSecretFormat("short")).toBe(false);
    expect(isValidPreviewSecretFormat("invalid secret with spaces")).toBe(false);
    expect(isValidPreviewSecretFormat("valid_secret_token_123456")).toBe(true);
  });
});

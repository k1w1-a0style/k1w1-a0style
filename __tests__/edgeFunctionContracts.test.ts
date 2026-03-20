import {
  parseJsonBody,
  validateGithubWorkflowDispatchRequest,
  validateTriggerBuildRequest,
} from "../supabase/functions/_shared/validation";

import { SUPABASE_EDGE_FUNCTIONS } from "../shared/constants/supabase";

/**
 * Contract tests for Supabase Edge Function request validation.
 *
 * Goal: keep the client <-> edge API stable even when refactors happen.
 */

describe("edge function request contracts", () => {
  describe("validateGithubWorkflowDispatchRequest", () => {
    it("accepts common alias keys and normalizes output without client token passthrough", () => {
      const res = validateGithubWorkflowDispatchRequest({
        github_repo: "k1w1-a0style/musik-player",
        workflowId: "eas-link.yml",
        branch: "dev",
        inputs: { profile: "development", projectId: "abc" },
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.githubRepo).toBe("k1w1-a0style/musik-player");
      expect(res.data.workflow).toBe("eas-link.yml");
      expect(res.data.ref).toBe("dev");
      expect(res.data.inputs).toEqual({ profile: "development", projectId: "abc" });
      expect(res.data).not.toHaveProperty("githubToken");
    });

    it("rejects missing ref instead of defaulting to main", () => {
      const res = validateGithubWorkflowDispatchRequest({
        githubRepo: "k1w1-a0style/musik-player",
        workflow: "eas-link.yml",
      });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.errors.ref).toContain("non-empty branch");
    });

    it("rejects refs/* and 40-char sha", () => {
      const a = validateGithubWorkflowDispatchRequest({
        githubRepo: "k1w1-a0style/musik-player",
        workflow: "eas-link.yml",
        ref: "refs/heads/main",
      });
      expect(a.ok).toBe(false);
      if (a.ok) return;
      expect(a.errors.ref).toBeTruthy();

      const b = validateGithubWorkflowDispatchRequest({
        githubRepo: "k1w1-a0style/musik-player",
        workflow: "eas-link.yml",
        ref: "0123456789abcdef0123456789abcdef01234567",
      });
      expect(b.ok).toBe(false);
      if (b.ok) return;
      expect(b.errors.ref).toBeTruthy();
    });

    it("rejects non-string inputs", () => {
      const res = validateGithubWorkflowDispatchRequest({
        githubRepo: "k1w1-a0style/musik-player",
        workflow: "eas-link.yml",
        inputs: { ok: true },
      });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.errors.inputs).toBeTruthy();
    });
  });

  describe("validateTriggerBuildRequest", () => {
    it("accepts alias keys and validates buildProfile", () => {
      const res = validateTriggerBuildRequest({
        repo: "k1w1-a0style/musik-player",
        build_profile: "preview",
        ref: "dev",
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.githubRepo).toBe("k1w1-a0style/musik-player");
      expect(res.data.buildProfile).toBe("preview");
      expect(res.data.branch).toBe("dev");
    });

    it("rejects invalid profile", () => {
      const res = validateTriggerBuildRequest({
        githubRepo: "k1w1-a0style/musik-player",
        buildProfile: "prod",
      });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.errors.buildProfile).toBeTruthy();
    });
  });



  describe("parseJsonBody", () => {
    it("rejects non-object JSON payloads", async () => {
      const req = new Request("https://example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(["not", "an", "object"]),
      });

      const res = await parseJsonBody(req);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toContain("body must be a JSON object");
    });
  });

  describe("edge function names single source", () => {
    it("contains production-used signing/preview/ai endpoints", () => {
      expect(SUPABASE_EDGE_FUNCTIONS.SAVE_PREVIEW).toBe("save_preview");
      expect(SUPABASE_EDGE_FUNCTIONS.PREVIEW_PAGE).toBe("preview_page");
      expect(SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_STATUS).toBe("android-keystore-status");
      expect(SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_GENERATE).toBe("android-keystore-generate");
      expect(SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_EXPORT).toBe("android-keystore-export");
      expect(SUPABASE_EDGE_FUNCTIONS.K1W1_HANDLER).toBe("k1w1-handler");
    });
  });

});

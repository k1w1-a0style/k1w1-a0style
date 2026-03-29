import { extractErrorMessage, getErrorMessage } from "../screens/GitHubReposScreen/hooks/githubReposScreenErrorHelpers";

describe("githubReposScreenErrorHelpers", () => {
  it("extracts message from Error instances", () => {
    expect(extractErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("extracts message from string throws", () => {
    expect(extractErrorMessage("kaputt")).toBe("kaputt");
  });

  it("extracts message from object-like throws", () => {
    expect(extractErrorMessage({ message: "network" })).toBe("network");
  });

  it("returns null for unknown payloads and applies fallback in getErrorMessage", () => {
    expect(extractErrorMessage({ detail: "missing" })).toBeNull();
    expect(getErrorMessage({ detail: "missing" }, "fallback")).toBe("fallback");
  });

  it("keeps empty-string fallback contract for alert catches", () => {
    expect(getErrorMessage(undefined, "")).toBe("");
  });
});

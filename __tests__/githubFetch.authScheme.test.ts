const mockFetchWithTimeout = jest.fn();

jest.mock("../supabase/functions/_shared/auth.ts", () => ({
  getRuntimeEnv: (name: string) => (name === "GITHUB_TOKEN" ? "ghp_test_token" : ""),
}));

jest.mock("../supabase/functions/_shared/fetchWithTimeout.ts", () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

import { githubFetch, githubFetchRaw } from "../supabase/functions/_shared/github";

describe("github fetch auth hardening", () => {
  beforeEach(() => {
    mockFetchWithTimeout.mockReset();
  });

  it("uses a single Bearer request path for githubFetch on 401", async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));

    const res = await githubFetch("https://api.github.com/repos/owner/repo");

    expect(res.status).toBe(401);
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    const init = mockFetchWithTimeout.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer ghp_test_token");
  });

  it("uses a single Bearer request path for githubFetchRaw on 401", async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));

    const res = await githubFetchRaw("https://api.github.com/repos/owner/repo", "raw_token");

    expect(res.status).toBe(401);
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    const init = mockFetchWithTimeout.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer raw_token");
  });
});

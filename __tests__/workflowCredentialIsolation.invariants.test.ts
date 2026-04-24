import fs from "fs";
import path from "path";

const read = (file: string): string =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");

describe("workflow credential isolation", () => {
  it("sets persist-credentials: false in all scoped workflows", () => {
    const files = [
      ".github/workflows/eas-build.yml",
      ".github/workflows/eas-link.yml",
      ".github/workflows/k1w1-ci-lite-autofix.yml",
      ".github/workflows/edge-live-contracts.yml",
      ".github/workflows/edge-fn-smoke-test.yml",
    ];

    for (const file of files) {
      const src = read(file);
      expect(src).toContain("persist-credentials: false");
      expect(src).not.toContain("persist-credentials: true");
    }
  });

  it("keeps writeback credentials explicit and late for push steps", () => {
    const easLink = read(".github/workflows/eas-link.yml");
    expect(easLink).toContain("- name: Commit changes (if any)");
    expect(easLink).toContain("GITHUB_TOKEN: ${{ github.token }}");
    expect(easLink).toContain(
      'git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"',
    );

    const ciLiteAutofix = read(".github/workflows/k1w1-ci-lite-autofix.yml");
    expect(ciLiteAutofix).toContain("- name: Guarded writeback (commit + push)");
    expect(ciLiteAutofix).toContain("GITHUB_TOKEN: ${{ github.token }}");
    expect(ciLiteAutofix).toContain(
      'git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"',
    );
  });
});

import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 476 flow-copy consistency invariants", () => {
  it("keeps build gate hints routed to GitHub-Repos screen", () => {
    const src = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");
    expect(src).toContain("Repo fehlt (im GitHub-Repos-Screen verknuepfen)");
    expect(src).toContain("Branch fehlt (im GitHub-Repos-Screen auswaehlen)");
  });

  it("documents app-managed secret sync scope and manual production boundary", () => {
    const syncSummary = read("screens/ConnectionsScreen/index.tsx");
    const secretsSection = read("screens/GitHubReposScreen/components/SecretsSection/index.tsx");

    expect(syncSummary).toContain("Automatisch per Secret-Sync ins aktive Repo");
    expect(syncSummary).toContain("Nicht aus der App auto-synchronisiert:");
    expect(secretsSection).toContain("SUPABASE_SERVICE_ROLE_KEY bleibt bewusst ein manueller Production-Schritt");
  });

  it("keeps EAS responsibility split between Connections and Repo flow", () => {
    const connections = read("screens/ConnectionsScreen/components/EasCard.tsx");
    const repos = read("screens/GitHubReposScreen/index.tsx");
    const easLinkSection = read("screens/GitHubReposScreen/components/EasLinkSection.tsx");

    expect(connections).toContain("Wird beim EAS-Link im GitHub-Repos-Screen genutzt");
    expect(repos + easLinkSection).toContain(
      "Tokens/Grundverbindungen pflegst du weiterhin im Verbindungen-Screen.",
    );
  });
});

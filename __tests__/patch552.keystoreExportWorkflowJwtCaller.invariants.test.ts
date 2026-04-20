import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch552 keystore export caller JWT contract invariants", () => {
  it("keeps workflow callers aligned with verify_jwt=true on android-keystore-export", () => {
    const easBuild = read(".github/workflows/eas-build.yml");
    expect(easBuild).toContain('/functions/v1/android-keystore-export');
    expect(easBuild).toContain('Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}');
    const diagnosticsBlock = easBuild.split("- name: Upload build diagnostics")[1]?.split("- name: Cleanup signing files")[0] ?? "";
    expect(diagnosticsBlock).not.toContain("ci-logs/keystore-request.json");
    expect(easBuild).toContain("retention-days: 3");

    const releaseBuild = read(".github/workflows/release-build.yml");
    expect(releaseBuild).toContain('/functions/v1/android-keystore-export');
    expect(releaseBuild).toContain('Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}');
  });
});

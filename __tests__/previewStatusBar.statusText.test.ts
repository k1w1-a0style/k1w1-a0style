import { getStatusText } from "../screens/PreviewScreen/components/PreviewStatusBar";

describe("PreviewStatusBar status text semantics", () => {
  it("shows local fallback as last known state", () => {
    expect(getStatusText("ready", "local")).toContain("letzter bekannter Stand");
  });

  it("keeps supabase ready wording explicit", () => {
    expect(getStatusText("ready", "supabase")).toBe("Live-Preview aktiv (Supabase)");
  });
});

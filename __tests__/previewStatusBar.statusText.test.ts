import {
  getStatusText,
  getTransientPreviewNotice,
} from "../screens/PreviewScreen/components/PreviewStatusBar";

describe("PreviewStatusBar status text semantics", () => {
  it("shows local fallback as last known state", () => {
    expect(getStatusText("ready", "local")).toContain("letzter bekannter Stand");
  });

  it("keeps supabase ready wording explicit", () => {
    expect(getStatusText("ready", "supabase")).toBe("Live-Preview aktiv (Supabase)");
  });

  it("keeps a transient local rehydration notice visible when provided", () => {
    expect(
      getTransientPreviewNotice(
        "Die letzte lokale HTML-Preview war nur temporär und ist nach Restart/Rehydration nicht mehr verfügbar. Bitte Preview neu erstellen.",
      ),
    ).toContain("nur temporär");
  });
});

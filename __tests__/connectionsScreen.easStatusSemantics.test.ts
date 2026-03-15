import { buildEasStatusDetail } from "../screens/ConnectionsScreen/components/StatusCard";

describe("ConnectionsScreen EAS status semantics", () => {
  it("marks running workflow explicitly", () => {
    expect(
      buildEasStatusDetail({
        easInitRunning: true,
        easProjectId: "11111111-1111-1111-1111-111111111111",
        easOk: true,
      }),
    ).toContain("Verknüpfung läuft");
  });

  it("marks missing project id as not configured", () => {
    expect(buildEasStatusDetail({ easProjectId: "", easOk: false })).toBe(
      "Keine EAS Project ID gespeichert.",
    );
  });

  it("marks linked-but-not-verified distinctly", () => {
    expect(
      buildEasStatusDetail({
        easProjectId: "11111111-1111-1111-1111-111111111111",
        easOk: true,
        easLastVerifiedAt: null,
      }),
    ).toContain("noch nicht frisch verifiziert");
  });

  it("marks stale/unknown status honestly", () => {
    expect(
      buildEasStatusDetail({
        easProjectId: "11111111-1111-1111-1111-111111111111",
        easOk: false,
      }),
    ).toContain("Zuletzt bekannter Status");
  });
});

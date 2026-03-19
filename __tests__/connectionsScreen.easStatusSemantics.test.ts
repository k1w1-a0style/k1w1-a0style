import {
  buildEasStatusDetail,
  resolveEasVerificationPresentation,
} from "../screens/ConnectionsScreen/components/StatusCard";

describe("ConnectionsScreen EAS status semantics", () => {
  it("marks running workflow explicitly", () => {
    expect(
      buildEasStatusDetail({
        easInitRunning: true,
        easProjectId: "11111111-1111-1111-1111-111111111111",
        easState: "verified",
      }),
    ).toContain("Verknüpfung läuft");
  });

  it("marks missing project id as not configured", () => {
    expect(buildEasStatusDetail({ easProjectId: "", easState: "missing" })).toBe(
      "Keine EAS Project ID gespeichert.",
    );
  });

  it("marks linked-but-not-verified distinctly", () => {
    expect(
      buildEasStatusDetail({
        easProjectId: "11111111-1111-1111-1111-111111111111",
        easState: "verified",
        easLastVerifiedAt: null,
      }),
    ).toContain("noch nicht frisch verifiziert");
  });

  it("marks stale/unknown status honestly", () => {
    expect(
      buildEasStatusDetail({
        easProjectId: "11111111-1111-1111-1111-111111111111",
        easState: "unknown",
      }),
    ).toContain("nicht sicher verifizierbar");
  });

  it("maps auth problems to a non-missing badge", () => {
    const result = resolveEasVerificationPresentation({
      easProjectId: "11111111-1111-1111-1111-111111111111",
      easState: "auth_error",
    });

    expect(result.stateLabel).toBe("ZUGRIFF");
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("nicht bestaetigen");
  });
});

import {
  resolveContextLabel,
  resolvePhaseHint,
  resolvePrimaryActionLabel,
} from "../screens/EnhancedBuildScreen/hooks/statusCommunication";

describe("build screen status communication", () => {
  it("trennt laufenden Kontext von letzter bekanntem Kontext", () => {
    expect(resolveContextLabel("starting", true)).toBe("Laufender Build (aktiver Kontext)");
    expect(resolveContextLabel("building", true)).toBe("Laufender Build (aktiver Kontext)");
    expect(resolveContextLabel("success", true)).toBe("Letzter bekannter Build-Kontext (kein Live-Status)");
    expect(resolveContextLabel("idle", false)).toBe("Aktuelle Auswahl (noch kein Lauf)");
  });

  it("liefert ruhige Phase-Hinweise für readiness und blockierung", () => {
    expect(resolvePhaseHint("starting", null)).toBe("Build-Start läuft");
    expect(resolvePhaseHint("idle", null)).toBe("Bereit zum Start");
    expect(resolvePhaseHint("idle", "Repo fehlt")).toBe("Vorbereitung unvollständig");
    expect(resolvePhaseHint("failed", null)).toBe("Build blockiert (Fehler)");
  });

  it("stellt die Hauptaktion für den Autoflow eindeutig bereit", () => {
    expect(
      resolvePrimaryActionLabel({ isDeploying: false, hasFail: false, deployDone: false, deployBlocked: false }),
    ).toBe("Build mit Vorbereitung starten");
    expect(
      resolvePrimaryActionLabel({ isDeploying: false, hasFail: true, deployDone: false, deployBlocked: false }),
    ).toBe("Vorbereitung erneut ausführen");
    expect(
      resolvePrimaryActionLabel({ isDeploying: false, hasFail: false, deployDone: false, deployBlocked: true }),
    ).toBe("Build noch nicht bereit");
  });
});

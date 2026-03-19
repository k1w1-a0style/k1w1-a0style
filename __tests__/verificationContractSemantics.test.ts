import { describeReadinessContract } from "../screens/EnhancedBuildScreen/hooks/buildReadinessState";
import {
  resolveEasVerificationPresentation,
} from "../screens/ConnectionsScreen/components/StatusCard";
import {
  describeRepoSecretContract,
} from "../lib/diagnostics/buildPipelineDiagnostics";
import {
  classifyVerificationError,
  normalizeVerificationContract,
} from "../lib/status/verificationContract";

describe("verification contract semantics", () => {
  it("does not classify auth/permission or temporary errors as missing", () => {
    expect(classifyVerificationError({ statusCode: 403 })).toBe("auth_error");
    expect(classifyVerificationError({ error: new Error("temporary network timeout") })).toBe("unknown");

    expect(
      normalizeVerificationContract({ statusCode: 403 }).isHardMissing,
    ).toBe(false);
    expect(
      normalizeVerificationContract({ error: new Error("temporary network timeout") }).isHardMissing,
    ).toBe(false);
  });

  it("keeps stale verification recognizably uncertain", () => {
    const contract = normalizeVerificationContract({ explicitState: "stale" });

    expect(contract.state).toBe("stale");
    expect(contract.isVerified).toBe(false);
    expect(contract.isUncertain).toBe(true);
  });

  it("keeps cross-screen semantics aligned for uncertain/auth states", () => {
    const authState = normalizeVerificationContract({ statusCode: 401 }).state;
    const easPresentation = resolveEasVerificationPresentation({
      easProjectId: "11111111-1111-1111-1111-111111111111",
      easState: authState,
    });
    const secretHint = describeRepoSecretContract({
      name: "EXPO_TOKEN",
      state: authState,
    });
    const staleReadiness = describeReadinessContract({
      area: "ci_lite",
      state: "stale",
    });

    expect(easPresentation.stateLabel).toBe("ZUGRIFF");
    expect(easPresentation.stateTone).toBe("warn");
    expect(secretHint.status).toBe("warn");
    expect(String(secretHint.fixHint || "")).not.toMatch(/fehlt/i);
    expect(staleReadiness).toMatch(/veraltet/i);
  });
});

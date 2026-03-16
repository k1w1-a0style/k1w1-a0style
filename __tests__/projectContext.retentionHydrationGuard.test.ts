import { shouldApplyHydratedRetention } from "../contexts/ProjectContext";

describe("shouldApplyHydratedRetention", () => {
  it("applies hydrated value before user/runtime override", () => {
    expect(shouldApplyHydratedRetention(false)).toBe(true);
  });

  it("does not overwrite a freshly set runtime retention value", () => {
    expect(shouldApplyHydratedRetention(true)).toBe(false);
  });
});

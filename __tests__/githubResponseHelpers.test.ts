import {
  hasGitHubErrorMessageContaining,
  readBooleanField,
  readGitHubMessage,
  readJsonArraySafe,
  readJsonRecordSafe,
  readNestedSha,
  readNumberField,
  readRecordArrayField,
  readStringField,
} from "../infra/github/githubResponseHelpers";

describe("githubResponseHelpers", () => {
  test("readJsonRecordSafe returns an empty record for non-object JSON", async () => {
    const response = { json: async () => ["bad"] } as Response;
    await expect(readJsonRecordSafe(response)).resolves.toEqual({});
  });

  test("readJsonRecordSafe returns an empty record when json parsing fails", async () => {
    const response = { json: async () => { throw new Error("boom"); } } as Response;
    await expect(readJsonRecordSafe(response)).resolves.toEqual({});
  });

  test("readJsonArraySafe returns filtered objects for array payloads", async () => {
    const response = { json: async () => [{ id: 1 }, null, "bad"] } as Response;
    await expect(readJsonArraySafe(response)).resolves.toEqual([{ id: 1 }]);
  });

  test("reads GitHub message and string fields safely", () => {
    const record = { message: "  nope  ", login: " user " };
    expect(readGitHubMessage(record)).toBe("nope");
    expect(readStringField(record, "login")).toBe("user");
    expect(readStringField(record, "missing")).toBe("");
  });

  test("reads boolean and number fields safely", () => {
    expect(readBooleanField({ protected: true }, "protected")).toBe(true);
    expect(readBooleanField({ protected: "yes" }, "protected")).toBe(false);
    expect(readNumberField({ id: 42 }, "id")).toBe(42);
    expect(readNumberField({ id: "42" }, "id")).toBeNull();
  });


  test("reads record arrays safely", () => {
    expect(readRecordArrayField({ secrets: [{ name: "A" }, null, "bad"] }, "secrets")).toEqual([{ name: "A" }]);
    expect(readRecordArrayField({ secrets: {} }, "secrets")).toEqual([]);
  });

  test("reads nested sha safely", () => {
    expect(readNestedSha({ object: { sha: " abc123 " } }, "object")).toBe("abc123");
    expect(readNestedSha({ object: null }, "object")).toBe("");
  });

  test("detects GitHub validation error messages in errors arrays", () => {
    expect(
      hasGitHubErrorMessageContaining(
        { errors: [{ message: "name already exists on this account" }] },
        "name already exists",
      ),
    ).toBe(true);

    expect(hasGitHubErrorMessageContaining({ errors: [null, { foo: "bar" }] }, "exists")).toBe(false);
  });
});

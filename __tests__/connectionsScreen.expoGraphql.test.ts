import { parseExpoGraphQLUsername } from "../screens/ConnectionsScreen/utils/expoGraphql";

describe("parseExpoGraphQLUsername", () => {
  it("returns username from valid payload", () => {
    const raw = JSON.stringify({
      data: { me: { username: "alice" } },
    });

    expect(parseExpoGraphQLUsername(raw)).toBe("alice");
  });

  it("throws for malformed JSON payload", () => {
    expect(() => parseExpoGraphQLUsername("<html>proxy error</html>")).toThrow(
      "kein valides JSON",
    );
  });

  it("throws when payload has no user data", () => {
    expect(() => parseExpoGraphQLUsername("{}")).toThrow(
      "keine Nutzerdaten",
    );
  });

  it("throws for GraphQL errors", () => {
    const raw = JSON.stringify({
      errors: [{ message: "Invalid token" }],
    });

    expect(() => parseExpoGraphQLUsername(raw)).toThrow("Invalid token");
  });
});

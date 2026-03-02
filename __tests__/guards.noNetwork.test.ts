describe("test guard no-network", () => {
  it("blocks unmocked global fetch calls", () => {
    expect(() => global.fetch("https://example.com")).toThrow(
      /Unexpected real network call via fetch/,
    );
  });

  it("blocks unmocked XMLHttpRequest", () => {
    expect(() => new global.XMLHttpRequest()).toThrow(
      /Unexpected real network call via XMLHttpRequest/,
    );
  });

  it("blocks unmocked WebSocket", () => {
    expect(() => new global.WebSocket("wss://example.com")).toThrow(
      /Unexpected real network call via WebSocket/,
    );
  });
});

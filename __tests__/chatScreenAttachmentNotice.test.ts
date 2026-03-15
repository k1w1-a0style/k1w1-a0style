import { buildUserInputWithAttachmentNotice } from "../screens/ChatScreen/hooks/chatScreenTypes";

describe("buildUserInputWithAttachmentNotice", () => {
  it("returns trimmed text when no attachment is selected", () => {
    expect(buildUserInputWithAttachmentNotice("  hello  ", null)).toBe("hello");
  });

  it("appends honest metadata-only notice for selected file", () => {
    const text = buildUserInputWithAttachmentNotice("Bitte analysieren", {
      name: "report.pdf",
      size: 2048,
      uri: "file:///tmp/report.pdf",
      mimeType: "application/pdf",
    } as any);

    expect(text).toContain("Bitte analysieren");
    expect(text).toContain("report.pdf");
    expect(text).toContain("nur Dateiname/Metadaten");
    expect(text).not.toContain("vollständige Dateiinhalt");
  });

  it("adds stronger warning for larger files", () => {
    const text = buildUserInputWithAttachmentNotice("", {
      name: "big.zip",
      size: 200 * 1024,
      uri: "file:///tmp/big.zip",
      mimeType: "application/zip",
    } as any);

    expect(text).toContain("big.zip");
    expect(text).toContain("nicht der vollständige Dateiinhalt");
  });
});

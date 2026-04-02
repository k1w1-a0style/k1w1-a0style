import {
  buildUserInputWithAttachmentNotice,
  type AttachmentNoticeAsset,
} from "../screens/ChatScreen/hooks/chatScreenTypes";

function makeAttachment(overrides: Partial<AttachmentNoticeAsset> = {}): AttachmentNoticeAsset {
  return {
    name: "attachment.txt",
    size: 1024,
    ...overrides,
  };
}

describe("buildUserInputWithAttachmentNotice", () => {
  it("returns trimmed text when no attachment is selected", () => {
    expect(buildUserInputWithAttachmentNotice("  hello  ", null)).toBe("hello");
  });

  it("appends honest metadata-only notice for selected file", () => {
    const text = buildUserInputWithAttachmentNotice(
      "Bitte analysieren",
      makeAttachment({ name: "report.pdf", size: 2048 }),
    );

    expect(text).toContain("Bitte analysieren");
    expect(text).toContain("report.pdf");
    expect(text).toContain("nur Dateiname/Metadaten");
    expect(text).not.toContain("vollständige Dateiinhalt");
  });

  it("adds stronger warning for larger files", () => {
    const text = buildUserInputWithAttachmentNotice(
      "",
      makeAttachment({ name: "big.zip", size: 200 * 1024 }),
    );

    expect(text).toContain("big.zip");
    expect(text).toContain("nicht der vollständige Dateiinhalt");
  });
});

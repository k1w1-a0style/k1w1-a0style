import {
  buildQrImageUrl,
  formatPreviewExpiry,
  getPreviewChannelLabel,
  shouldAttemptSupabaseFirst,
} from "../hooks/previewHelpers";

describe("previewHelpers", () => {
  test("mode selection keeps supabase preferred unless local explicit", () => {
    expect(shouldAttemptSupabaseFirst(undefined)).toBe(true);
    expect(shouldAttemptSupabaseFirst(null)).toBe(true);
    expect(shouldAttemptSupabaseFirst("supabase")).toBe(true);
    expect(shouldAttemptSupabaseFirst("local")).toBe(false);
  });

  test("formatPreviewExpiry returns readable validity states", () => {
    const now = new Date("2026-03-14T10:00:00.000Z");

    expect(formatPreviewExpiry(null, now)).toBe("Keine Ablaufzeit vorhanden");
    expect(formatPreviewExpiry("invalid", now)).toBe("Ablaufzeit unbekannt");
    expect(formatPreviewExpiry("2026-03-14T09:59:00.000Z", now)).toBe(
      "Abgelaufen – bitte Preview neu erstellen",
    );
    expect(formatPreviewExpiry("2026-03-14T10:20:00.000Z", now)).toBe(
      "Gültig für ca. 20 min",
    );
  });

  test("labels communicate primary supabase path and fallback", () => {
    expect(getPreviewChannelLabel("supabase")).toBe(
      "Bevorzugter Browser-/WebView-Preview-Weg",
    );
    expect(getPreviewChannelLabel("local")).toBe(
      "Technischer Local-HTML-Fallback",
    );
    expect(getPreviewChannelLabel(null)).toBe("Noch keine Preview erstellt");
  });

  test("buildQrImageUrl encodes preview URL", () => {
    const url = "https://example.com/preview?a=1&b=2";
    expect(buildQrImageUrl(url)).toContain(
      "data=https%3A%2F%2Fexample.com%2Fpreview%3Fa%3D1%26b%3D2",
    );
  });
});

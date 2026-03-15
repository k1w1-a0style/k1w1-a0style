import {
  buildQrImageUrl,
  formatPreviewExpiry,
  getPreviewChannelLabel,
  shouldAttemptSupabaseFirst,
  isPreviewExpired,
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

    expect(formatPreviewExpiry(null, now)).toBe("Kein Ablauf hinterlegt (letzter bekannter Stand)");
    expect(formatPreviewExpiry("invalid", now)).toBe("Ablaufzeit konnte nicht gelesen werden");
    expect(formatPreviewExpiry("2026-03-14T09:59:00.000Z", now)).toBe(
      "Abgelaufen – letzte URL wird nicht mehr geladen, bitte neu erstellen",
    );
    expect(formatPreviewExpiry("2026-03-14T10:20:00.000Z", now)).toBe(
      "Gültig für ca. 20 min",
    );
  });

  test("labels communicate primary supabase path and fallback", () => {
    expect(getPreviewChannelLabel("supabase")).toBe(
      "Aktive Supabase-Preview (Browser/QR)",
    );
    expect(getPreviewChannelLabel("local")).toBe(
      "Technischer Fallback: Lokale HTML-Preview (nur solange App aktiv ist)",
    );
    expect(getPreviewChannelLabel(null)).toBe("Noch keine Preview aktiv");
  });



  test("isPreviewExpired only flags valid timestamps in the past", () => {
    const now = new Date("2026-03-14T10:00:00.000Z");

    expect(isPreviewExpired(null, now)).toBe(false);
    expect(isPreviewExpired("invalid", now)).toBe(false);
    expect(isPreviewExpired("2026-03-14T09:59:00.000Z", now)).toBe(true);
    expect(isPreviewExpired("2026-03-14T10:20:00.000Z", now)).toBe(false);
  });

  test("buildQrImageUrl encodes preview URL", () => {
    const url = "https://example.com/preview?a=1&b=2";
    expect(buildQrImageUrl(url)).toContain(
      "data=https%3A%2F%2Fexample.com%2Fpreview%3Fa%3D1%26b%3D2",
    );
  });
});

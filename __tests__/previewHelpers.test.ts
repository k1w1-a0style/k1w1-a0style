import {
  buildQrImageUrl,
  getPreviewMixedContentMode,
  formatPreviewExpiry,
  getPreviewChannelLabel,
  getPreviewRemoteUrlStatus,
  resolvePreviewDisplayState,
  shouldAttemptSupabaseFirst,
  shouldUseLocalPreviewFallback,
  isPreviewExpired,
} from "../hooks/previewHelpers";

describe("previewHelpers", () => {
  test("mode selection keeps supabase preferred unless local explicit", () => {
    expect(shouldAttemptSupabaseFirst(undefined)).toBe(true);
    expect(shouldAttemptSupabaseFirst(null)).toBe(true);
    expect(shouldAttemptSupabaseFirst("supabase")).toBe(true);
    expect(shouldAttemptSupabaseFirst("local")).toBe(false);
    expect(shouldUseLocalPreviewFallback(undefined)).toBe(false);
    expect(shouldUseLocalPreviewFallback("supabase")).toBe(false);
    expect(shouldUseLocalPreviewFallback("local")).toBe(true);
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
      "Primäre Remote-Preview (Supabase / Browser / QR)",
    );
    expect(getPreviewChannelLabel("local")).toBe(
      "Lokaler HTML-/Eval-Fallback (nur Dev/Best-Effort, nur solange App aktiv ist)",
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

  test("distinguishes remote ready, local fallback and unavailable preview states", () => {
    expect(
      resolvePreviewDisplayState({
        phase: "ready",
        previewKind: "supabase",
        previewSourceType: "url",
        remoteUrlStatus: "trusted",
        hasExpiredRemoteUrl: false,
        remoteFailure: null,
        stateError: null,
        webError: null,
        transientLocalPreviewNotice: null,
      }).kind,
    ).toBe("remote_ready");

    expect(
      resolvePreviewDisplayState({
        phase: "ready",
        previewKind: "local",
        previewSourceType: "html",
        remoteUrlStatus: "missing",
        hasExpiredRemoteUrl: false,
        remoteFailure: null,
        stateError: null,
        webError: null,
        transientLocalPreviewNotice: null,
      }).kind,
    ).toBe("fallback_active");

    expect(
      resolvePreviewDisplayState({
        phase: "idle",
        previewKind: null,
        previewSourceType: null,
        remoteUrlStatus: "missing",
        hasExpiredRemoteUrl: false,
        remoteFailure: null,
        stateError: null,
        webError: null,
        transientLocalPreviewNotice: null,
      }).kind,
    ).toBe("unavailable");
  });

  test("missing, invalid and insecure server URLs never become remote ready", () => {
    expect(getPreviewRemoteUrlStatus(null)).toBe("missing");
    expect(getPreviewRemoteUrlStatus("notaurl")).toBe("invalid");
    expect(getPreviewRemoteUrlStatus("http://preview.example.com")).toBe("insecure");
    expect(getPreviewRemoteUrlStatus("https://preview.example.com")).toBe("trusted");
    expect(getPreviewRemoteUrlStatus("http://localhost:8081")).toBe("trusted");

    expect(
      resolvePreviewDisplayState({
        phase: "ready",
        previewKind: "supabase",
        previewSourceType: null,
        remoteUrlStatus: "invalid",
        hasExpiredRemoteUrl: false,
        remoteFailure: null,
        stateError: null,
        webError: null,
        transientLocalPreviewNotice: null,
      }).kind,
    ).toBe("unavailable");
  });

  test("unreachable server yields an honest unavailable state", () => {
    const state = resolvePreviewDisplayState({
      phase: "idle",
      previewKind: "supabase",
      previewSourceType: null,
      remoteUrlStatus: "missing",
      hasExpiredRemoteUrl: false,
      remoteFailure: "Preview-Server derzeit nicht erreichbar.",
      stateError: null,
      webError: null,
      transientLocalPreviewNotice: null,
    });

    expect(state.kind).toBe("unavailable");
    expect(state.statusText).toBe("Remote-Preview nicht verfügbar");
    expect(state.detailText).toContain("nicht erreichbar");
  });

  test("preview webview policy keeps mixed content locked down", () => {
    expect(getPreviewMixedContentMode()).toBe("never");
  });
});


describe("preview fallback semantics", () => {
  test("fallback copy stays visibly secondary and dev-scoped", () => {
    const state = resolvePreviewDisplayState({
      phase: "ready",
      previewKind: "local",
      previewSourceType: "html",
      remoteUrlStatus: "missing",
      hasExpiredRemoteUrl: false,
      remoteFailure: null,
      stateError: null,
      webError: null,
      transientLocalPreviewNotice: null,
    });

    expect(state.statusText).toBe("Lokaler Dev-Fallback aktiv");
    expect(state.badgeText).toBe("Dev-Fallback");
    expect(state.detailText).toContain("Best-Effort");
  });
});

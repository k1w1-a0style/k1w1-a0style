import { shouldAttemptSupabaseFirst } from "../hooks/previewHelpers";

describe("preview mode selection", () => {
  test("prefers Supabase when mode is missing", () => {
    expect(shouldAttemptSupabaseFirst(undefined)).toBe(true);
    expect(shouldAttemptSupabaseFirst(null)).toBe(true);
  });

  test("prefers Supabase when mode is supabase", () => {
    expect(shouldAttemptSupabaseFirst("supabase")).toBe(true);
  });

  test("uses local mode only when explicitly selected", () => {
    expect(shouldAttemptSupabaseFirst("local")).toBe(false);
  });
});

import { useEffect, type MutableRefObject } from "react";

import { deriveSupabaseUrl } from "../utils/validation";

type Params = {
  hydrated: boolean;
  didAutoTestEas: MutableRefObject<boolean>;
  expoToken: string;
  easProjectId: string;
  testEas: () => Promise<void>;
  supabaseRaw: string;
  setSupabaseUrl: (value: string) => void;
};

export function useConnectionsDerivedEffects(params: Params) {
  const {
    hydrated,
    didAutoTestEas,
    expoToken,
    easProjectId,
    testEas,
    supabaseRaw,
    setSupabaseUrl,
  } = params;
  useEffect(() => {
    if (!hydrated) return;
    if (didAutoTestEas.current) return;
    if (!expoToken.trim()) return;
    if (!easProjectId.trim()) return;
    didAutoTestEas.current = true;
    void testEas();
  }, [hydrated, didAutoTestEas, expoToken, easProjectId, testEas]);

  useEffect(() => {
    const d = deriveSupabaseUrl(supabaseRaw);
    setSupabaseUrl(d.url);
  }, [supabaseRaw, setSupabaseUrl]);
}

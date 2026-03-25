import fs from "fs";
import path from "path";

import { PROVIDER_DEFAULTS } from "../contexts/AIContext";
import { SHARED_PROVIDER_DEFAULTS } from "../shared/ai/providerDefaults";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("k1w1-handler provider invariants", () => {
  it("keeps all 5 providers in DEFAULT_MODELS", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain("groq");
    expect(src).toContain("gemini");
    expect(src).toContain("openai");
    expect(src).toContain("anthropic");
    expect(src).toContain("huggingface");
  });

  it("keeps all 5 provider call helpers", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain("export async function callGroq(");
    expect(src).toContain("export async function callGemini(");
    expect(src).toContain("export async function callOpenAI(");
    expect(src).toContain("export async function callAnthropic(");
    expect(src).toContain("export async function callHuggingFace(");
  });

  it("keeps required provider secrets server-side", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain('getRuntimeEnv("GROQ_API_KEY")');
    expect(src).toContain('getRuntimeEnv("GEMINI_API_KEY")');
    expect(src).toContain('getRuntimeEnv("OPENAI_API_KEY")');
    expect(src).toContain('getRuntimeEnv("ANTHROPIC_API_KEY")');
    expect(src).toContain('getRuntimeEnv("HUGGINGFACE_API_KEY")');
  });

  it("keeps app defaults aligned to the shared runtime-supported provider ids", () => {
    expect(PROVIDER_DEFAULTS).toEqual(SHARED_PROVIDER_DEFAULTS);
    expect(SHARED_PROVIDER_DEFAULTS.groq).toEqual({
      speed: "llama-3.1-8b-instant",
      quality: "llama-3.3-70b-versatile",
    });
    expect(SHARED_PROVIDER_DEFAULTS.gemini).toEqual({
      speed: "gemini-3.1-flash-lite",
      quality: "gemini-3.1-pro",
    });
    expect(SHARED_PROVIDER_DEFAULTS.anthropic).toEqual({
      speed: "claude-4-haiku-202502",
      quality: "claude-4-opus-202502",
    });
  });



  it("guards runtime-safe provider default ids for Groq/Gemini/Anthropic", () => {
    expect(SHARED_PROVIDER_DEFAULTS.groq.speed).toBe("llama-3.1-8b-instant");
    expect(SHARED_PROVIDER_DEFAULTS.groq.quality).toBe("llama-3.3-70b-versatile");
    expect(SHARED_PROVIDER_DEFAULTS.gemini.speed).toBe("gemini-3.1-flash-lite");
    expect(SHARED_PROVIDER_DEFAULTS.gemini.quality).toBe("gemini-3.1-pro");
    expect(SHARED_PROVIDER_DEFAULTS.anthropic.speed).toBe("claude-4-haiku-202502");
    expect(SHARED_PROVIDER_DEFAULTS.anthropic.quality).toBe("claude-4-opus-202502");
  });

  it("imports the shared provider defaults in the edge helper", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain('import { SHARED_PROVIDER_DEFAULTS } from "../../../shared/ai/providerDefaults.ts";');
    expect(src).toContain('import { resolveRuntimeModelId } from "../../../shared/ai/modelRuntimeMap.ts";');
    expect(src).toContain("export const DEFAULT_MODELS = SHARED_PROVIDER_DEFAULTS;");
    expect(src).toContain("resolveProviderModelForRuntime");
    expect(src).toContain("Runtime-Mapping aktiv");
  });

  it("keeps Groq model-prefix fallback for compatibility", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain('model.startsWith("groq/") ? model.slice("groq/".length) : model');
  });

  it("hardens anthropic request mapping when only system messages exist", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain("const safeMessages =");
    expect(src).toContain("Please respond to the system instructions.");
    expect(src).toContain("messages: safeMessages");
  });

  it("maps gemini system prompts explicitly and keeps non-empty contents fallback", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain("systemInstruction");
    expect(src).toContain("nonSystemMessages.length > 0");
    expect(src).toContain('{ role: "user", content: systemInstructionText || "Continue." }');
  });

  it("does not keep duplicate gemini parts nullish-coalescing", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain("const parts = json?.candidates?.[0]?.content?.parts ?? [];");
    expect(src).not.toContain("json?.candidates?.[0]?.content?.parts ??\n    json?.candidates?.[0]?.content?.parts ??");
  });

  it("routes all 5 providers in index.ts", () => {
    const src = read("supabase/functions/k1w1-handler/index.ts");

    expect(src).toContain('providerLower === "groq"');
    expect(src).toContain('providerLower === "gemini"');
    expect(src).toContain('providerLower === "openai"');
    expect(src).toContain('providerLower === "anthropic"');
    expect(src).toContain('providerLower === "huggingface"');
  });
});

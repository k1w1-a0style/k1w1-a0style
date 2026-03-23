import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("k1w1-handler provider invariants", () => {
  it("keeps all 5 providers in DEFAULT_MODELS", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain("groq:");
    expect(src).toContain("gemini:");
    expect(src).toContain("openai:");
    expect(src).toContain("anthropic:");
    expect(src).toContain("huggingface:");
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



  it("uses aligned, runtime-supported default model ids", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    // Keep edge defaults aligned with app model catalog defaults.
    expect(src).toContain('speed: "groq/compound-mini"');
    expect(src).toContain('quality: "llama-3.3-70b-versatile"');

    expect(src).toContain('speed: "gemini-2.5-flash-lite"');
    expect(src).toContain('quality: "gemini-2.5-flash"');

    expect(src).toContain('speed: "gpt-4o-mini"');
    expect(src).toContain('quality: "gpt-4o"');

    expect(src).toContain('speed: "claude-3-5-haiku-20241022"');
    expect(src).toContain('quality: "claude-3-5-sonnet-20241022"');

    expect(src).toContain('speed: "Qwen/Qwen2.5-7B-Instruct"');
    expect(src).toContain('quality: "Qwen/Qwen2.5-Coder-32B-Instruct"');

    expect(src).not.toContain('claude-3-5-haiku-latest');
    expect(src).not.toContain('claude-3-5-sonnet-latest');
    expect(src).not.toContain('gemini-1.5-flash');
    expect(src).not.toContain('gemini-1.5-pro');
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

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

    expect(src).toContain('Deno.env.get("GROQ_API_KEY")');
    expect(src).toContain('Deno.env.get("GEMINI_API_KEY")');
    expect(src).toContain('Deno.env.get("OPENAI_API_KEY")');
    expect(src).toContain('Deno.env.get("ANTHROPIC_API_KEY")');
    expect(src).toContain('Deno.env.get("HUGGINGFACE_API_KEY")');
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

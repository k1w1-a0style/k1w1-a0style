import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("k1w1-handler live reachability error contracts", () => {
  it("includes provider + model in upstream HTTP errors", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain("function providerHttpError(");
    expect(src).toContain("(model=${model})");
  });

  it("keeps visible Groq model IDs while allowing runtime mapping and prefix fallback", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain('const resolvedSelection = resolveProviderModelForRuntime("groq", selectedModel);');
    expect(src).toContain('const fallbackModel = model.startsWith("groq/") ? model.slice("groq/".length) : model;');
    expect(src).toContain("model: resolvedSelection.visibleModel");
  });
});

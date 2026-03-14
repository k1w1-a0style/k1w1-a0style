import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("k1w1-handler live reachability error contracts", () => {
  it("includes provider + model in upstream HTTP errors", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain("function providerHttpError(");
    expect(src).toContain("(model=${model})");
  });

  it("returns the actual resolved Groq model after prefix fallback", () => {
    const src = read("supabase/functions/k1w1-handler/helpers.ts");

    expect(src).toContain("let resolvedModel = model;");
    expect(src).toContain("resolvedModel = fallbackModel;");
    expect(src).toContain("return { content, raw: json, model: resolvedModel };");
  });
});

import { validateSyntax } from "../utils/syntaxValidator";

describe("syntaxValidator", () => {
  it("does not count brackets inside regex, strings, or comments as unmatched delimiters", () => {
    const code = [
      "const re = /[{(]/g;",
      "const msg = 'hello (world)';",
      "// comment [ should not count",
      "const obj = { a: [1, 2, 3] };",
    ].join("\n");

    const errors = validateSyntax(code, "Editor.ts");

    expect(errors.some((error) => error.message.includes("Ungleiche Anzahl von Klammern"))).toBe(false);
  });

  it("still reports genuinely unmatched delimiters as errors", () => {
    const code = "const broken = { value: [1, 2, 3;";

    const errors = validateSyntax(code, "broken.ts");

    expect(errors).toContainEqual(
      expect.objectContaining({
        severity: "error",
        message: expect.stringContaining("Ungleiche Anzahl von Klammern"),
      }),
    );
  });


  it("still reports unmatched delimiters inside template expressions", () => {
    const code = "export const Demo = () => `${foo(}`;";

    const errors = validateSyntax(code, "Demo.tsx");

    expect(errors).toContainEqual(
      expect.objectContaining({
        severity: "error",
        message: expect.stringContaining("Ungleiche Anzahl von Klammern"),
      }),
    );
  });

  it("does not flag imports that are used exactly once outside the import line", () => {
    const code = [
      "import { useState } from 'react';",
      "const [value, setValue] = useState(0);",
      "export const Demo = () => value;",
    ].join("\n");

    const errors = validateSyntax(code, "Demo.tsx");

    expect(errors.some((error) => error.message.includes('Import "useState" scheint ungenutzt zu sein'))).toBe(false);
  });

  it("still warns for truly unused imports", () => {
    const code = [
      "import { useState } from 'react';",
      "export const Demo = () => null;",
    ].join("\n");

    const errors = validateSyntax(code, "Demo.tsx");

    expect(errors).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        message: 'Import "useState" scheint ungenutzt zu sein',
      }),
    );
  });
});

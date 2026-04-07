import { buildSandpackHtml } from "../sandpackBuilder";

describe("buildSandpackHtml", () => {
  it("keeps local eval fallback disabled by default", () => {
    const html = buildSandpackHtml({
      title: "Preview",
      files: {
        "/App.tsx": "export default function App() { return <div>Hello</div>; }",
      },
    });

    expect(html).toContain("Lokaler HTML-/Eval-Fallback deaktiviert");
    expect(html).not.toContain("unsafe-eval");
    expect(html).not.toContain("@babel/standalone");
  });
});


it("labels the generated preview as a non-primary local fallback", () => {
  const html = buildSandpackHtml({
    title: "Preview",
    files: {
      "/App.tsx": "export default function App() { return <div>Hello</div>; }",
    },
    allowUnsafeLocalEval: true,
  });

  expect(html).toContain("Lokaler HTML-/Eval-Fallback");
  expect(html).toContain("nicht server-verifiziert");
  expect(html).toContain("Dev-Fallback bereit");
});

it("disables eval/cdn runtime when local unsafe fallback is not explicitly allowed", () => {
  const html = buildSandpackHtml({
    title: "Preview",
    files: {
      "/App.tsx": "export default function App() { return <div>Hello</div>; }",
    },
    allowUnsafeLocalEval: false,
  });

  expect(html).toContain("Lokaler HTML-/Eval-Fallback deaktiviert");
  expect(html).not.toContain("unsafe-eval");
  expect(html).not.toContain("@babel/standalone");
  expect(html).not.toContain("new Function(");
});

it("renders eval/cdn runtime only with explicit opt-in", () => {
  const html = buildSandpackHtml({
    title: "Preview",
    files: {
      "/App.tsx": "export default function App() { return <div>Hello</div>; }",
    },
    allowUnsafeLocalEval: true,
  });

  expect(html).toContain("script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://esm.sh");
  expect(html).toContain("https://unpkg.com/@babel/standalone/babel.min.js");
  expect(html).toContain('"react": "https://esm.sh/react@19.1.0"');
});

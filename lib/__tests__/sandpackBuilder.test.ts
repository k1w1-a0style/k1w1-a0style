import { buildSandpackHtml } from "../sandpackBuilder";

describe("buildSandpackHtml", () => {
  it("keeps the local preview HTML clearly marked as a dev-only fallback while blocking arbitrary network requests", () => {
    const html = buildSandpackHtml({
      title: "Preview",
      files: {
        "/App.tsx": "export default function App() { return <div>Hello</div>; }",
      },
    });

    expect(html).toContain('<meta http-equiv="Content-Security-Policy" content="');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain(
      "script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://esm.sh",
    );
    expect(html).toContain("https://unpkg.com/@babel/standalone/babel.min.js");
    expect(html).toContain('"react": "https://esm.sh/react@19.1.0"');
  });
});


it("labels the generated preview as a non-primary local fallback", () => {
  const html = buildSandpackHtml({
    title: "Preview",
    files: {
      "/App.tsx": "export default function App() { return <div>Hello</div>; }",
    },
  });

  expect(html).toContain("Lokaler HTML-/Eval-Fallback");
  expect(html).toContain("nicht server-verifiziert");
  expect(html).toContain("Dev-Fallback bereit");
});

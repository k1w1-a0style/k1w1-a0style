import { buildChangePreviews } from "../lib/changePreview";

describe("buildChangePreviews", () => {
  it("builds a compact preview for new files", () => {
    const previews = buildChangePreviews({
      baseFiles: [],
      finalFiles: [
        {
          path: "components/NewBadge.tsx",
          content: "export const NewBadge = () => <Text>Neu</Text>;\nexport default NewBadge;",
        },
      ],
      created: ["components/NewBadge.tsx"],
      updated: [],
    });

    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      path: "components/NewBadge.tsx",
      kind: "new",
    });
    expect(previews[0]?.preview).toContain("export const NewBadge");
  });

  it("builds compact delta, before and after snippets for updated files", () => {
    const previews = buildChangePreviews({
      baseFiles: [
        {
          path: "App.tsx",
          content: [
            "export default function App() {",
            "  return <Text>Before</Text>;",
            "}",
          ].join("\n"),
        },
      ],
      finalFiles: [
        {
          path: "App.tsx",
          content: [
            "export default function App() {",
            "  return <Text>After</Text>;",
            "}",
          ].join("\n"),
        },
      ],
      created: [],
      updated: ["App.tsx"],
    });

    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      path: "App.tsx",
      kind: "updated",
    });
    expect(previews[0]?.diffSnippet).toContain("-   return <Text>Before</Text>;");
    expect(previews[0]?.diffSnippet).toContain("+   return <Text>After</Text>;");
    expect(previews[0]?.beforeSnippet).toContain("Before");
    expect(previews[0]?.afterSnippet).toContain("After");
  });
});

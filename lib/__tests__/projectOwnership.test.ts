import { applyFilesToProject } from "../fileWriter";
import { canActorModifyPath, findOwnershipViolations } from "../projectOwnership";

describe("project ownership guards", () => {
  it("blocks chat changes on critical config files", () => {
    const decision = canActorModifyPath("chat", "package.json");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("kritisch");
  });

  it("blocks both actors from template/baseline managed paths", () => {
    const chat = canActorModifyPath("chat", "templates/expo-sdk54-base.json");
    const diagnosis = canActorModifyPath("diagnosisAutofix", "docs/patches/patch_431.md");

    expect(chat.allowed).toBe(false);
    expect(diagnosis.allowed).toBe(false);
    expect(chat.reason).toContain("Template/Baseline");
    expect(diagnosis.reason).toContain("Template/Baseline");
  });

  it("restricts diagnosis/autofix to curated fix scope", () => {
    const violations = findOwnershipViolations("diagnosisAutofix", [
      "src/screens/Home.tsx",
      "eas.json",
      ".github/workflows/eas-build.yml",
    ]);

    expect(violations.map((v) => v.path)).toEqual(["src/screens/Home.tsx"]);
    expect(violations[0]?.reason).toContain("Zuständigkeitsbereich");
  });


  it("handles chat-vs-diagnosis conflict conservatively on workflow paths", () => {
    const chat = canActorModifyPath("chat", ".github/workflows/eas-build.yml");
    const diagnosis = canActorModifyPath("diagnosisAutofix", ".github/workflows/eas-build.yml");

    expect(chat.allowed).toBe(false);
    expect(diagnosis.allowed).toBe(true);
  });

  it("keeps protected baseline data untouched during chat apply flow", () => {
    const existing = [
      { path: "templates/expo-sdk54-base.json", content: "baseline" },
      { path: "App.tsx", content: "export default function App(){return null;}" },
    ];

    const incoming = [
      { path: "templates/expo-sdk54-base.json", content: "mutated" },
      { path: "App.tsx", content: "export default function App(){return <></>; }" },
    ];

    const result = applyFilesToProject(existing, incoming);

    expect(result.updated).toContain("App.tsx");
    expect(result.skipped).toContain("templates/expo-sdk54-base.json");
    expect(result.errors?.join("\n")).toContain("Template/Baseline");
    expect(result.files.find((f) => f.path === "templates/expo-sdk54-base.json")?.content).toBe("baseline");
  });
});

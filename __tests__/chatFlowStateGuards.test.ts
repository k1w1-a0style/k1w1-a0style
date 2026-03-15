import { buildProjectStateDigest, rebasePendingChangeOnLatest } from "../lib/chatFlowStateGuards";
import type { ProjectFile } from "../shared/types/project";

describe("chatFlowStateGuards", () => {
  const baseFiles: ProjectFile[] = [
    { path: "App.tsx", content: "export default function App(){return null}" },
    { path: "components/A.tsx", content: "export const A = () => null;" },
  ];

  test("buildProjectStateDigest is stable independent of file order", () => {
    const digestA = buildProjectStateDigest(baseFiles);
    const digestB = buildProjectStateDigest([baseFiles[1], baseFiles[0]]);

    expect(digestA).toBe(digestB);
  });

  test("rebasePendingChangeOnLatest applies proposedFiles against latest source of truth", () => {
    const pending = {
      files: [...baseFiles],
      proposedFiles: [{ path: "App.tsx", content: "export default function App(){return <A/>}" }],
      baseProjectDigest: buildProjectStateDigest(baseFiles),
    };

    const latestFiles: ProjectFile[] = [
      { path: "App.tsx", content: "export default function App(){return null}" },
      { path: "components/A.tsx", content: "export const A = () => <></>;" },
      { path: "components/B.tsx", content: "export const B = () => null;" },
    ];

    const { applyResult, driftDetected } = rebasePendingChangeOnLatest(latestFiles, pending);

    expect(driftDetected).toBe(true);
    expect(applyResult.files.find((f) => f.path === "components/B.tsx")?.content).toContain("B");
    expect(applyResult.files.find((f) => f.path === "App.tsx")?.content).toContain("<A/>");
  });

  test("rebasePendingChangeOnLatest does not flag drift when digest matches", () => {
    const pending = {
      files: [...baseFiles],
      proposedFiles: [{ path: "components/A.tsx", content: "export const A = () => <div/>;" }],
      baseProjectDigest: buildProjectStateDigest(baseFiles),
    };

    const { driftDetected } = rebasePendingChangeOnLatest(baseFiles, pending);
    expect(driftDetected).toBe(false);
  });

  test("falls back to pending.files when proposedFiles missing", () => {
    const pending = {
      files: [{ path: "components/A.tsx", content: "export const A = () => 'changed';" }],
      baseProjectDigest: buildProjectStateDigest(baseFiles),
    };

    const { applyResult } = rebasePendingChangeOnLatest(baseFiles, pending);
    expect(applyResult.updated).toContain("components/A.tsx");
  });

  test("buildProjectStateDigest detects same-length content drift", () => {
    const a: ProjectFile[] = [{ path: "App.tsx", content: "aaaa" }];
    const b: ProjectFile[] = [{ path: "App.tsx", content: "bbbb" }];

    expect(a[0].content.length).toBe(b[0].content.length);
    expect(buildProjectStateDigest(a)).not.toBe(buildProjectStateDigest(b));
  });

});

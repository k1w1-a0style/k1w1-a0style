import fs from "fs";
import path from "path";

describe("useChatAIFlow streaming sync invariants", () => {
  const file = path.join(process.cwd(), "hooks/chatAIFlow/useChatAITransientState.ts");
  const source = fs.readFileSync(file, "utf8");

  it("guards simulateStreaming ticks/completion against stale runs", () => {
    expect(source).toContain("const streamingRunIdRef = useRef(0);");
    expect(source).toContain("const runId = ++streamingRunIdRef.current;");
    expect(source).toContain("if (!isMountedRef.current || runId !== streamingRunIdRef.current)");
    expect(source).toContain("if (runId !== streamingRunIdRef.current) return;");
  });

  it("invalidates active streaming run during reset and unmount cleanup", () => {
    expect(source).toContain("streamingRunIdRef.current += 1;");
  });
});

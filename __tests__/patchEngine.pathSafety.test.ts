import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";
import type { PreflightPatch } from "../lib/diagnostics/preflightTypes";

describe("patch engine safety guards", () => {
  it("blocks unsafe traversal path", async () => {
    const patch: PreflightPatch = {
      upsert: [{ path: "../secrets.txt", content: "x" }],
    };

    await expect(applyPreflightPatch([], patch)).rejects.toThrow("Unsicherer Dateipfad");
  });

  it("blocks unsafe windows traversal path", async () => {
    const patch: PreflightPatch = {
      upsert: [{ path: "..\\secrets.txt", content: "x" }],
    };

    await expect(applyPreflightPatch([], patch)).rejects.toThrow("Unsicherer Dateipfad");
  });

  it("blocks unsafe absolute windows drive path", async () => {
    const patch: PreflightPatch = {
      upsert: [{ path: "C:\\temp\\secret.txt", content: "x" }],
    };

    await expect(applyPreflightPatch([], patch)).rejects.toThrow("Unsicherer Dateipfad");
  });

  it("blocks unsafe windows drive-relative path", async () => {
    const patch: PreflightPatch = {
      upsert: [{ path: "C:temp\\secret.txt", content: "x" }],
    };

    await expect(applyPreflightPatch([], patch)).rejects.toThrow("Unsicherer Dateipfad");
  });

  it("blocks unsafe UNC/rooted backslash paths", async () => {
    const uncPatch: PreflightPatch = {
      upsert: [{ path: "\\\\server\\share\\secrets.txt", content: "x" }],
    };
    const rootPatch: PreflightPatch = {
      upsert: [{ path: "\\windows\\temp.txt", content: "x" }],
    };

    await expect(applyPreflightPatch([], uncPatch)).rejects.toThrow("Unsicherer Dateipfad");
    await expect(applyPreflightPatch([], rootPatch)).rejects.toThrow("Unsicherer Dateipfad");
  });

  it("blocks mixed-separator traversal paths", async () => {
    const patch: PreflightPatch = {
      upsert: [{ path: "safe/..\\secrets.txt", content: "x" }],
    };

    await expect(applyPreflightPatch([], patch)).rejects.toThrow("Unsicherer Dateipfad");
  });

  it("blocks null-byte paths", async () => {
    const patch: PreflightPatch = {
      upsert: [{ path: `safe/\0secrets.txt`, content: "x" }],
    };

    await expect(applyPreflightPatch([], patch)).rejects.toThrow("Unsicherer Dateipfad");
  });

  it("blocks oversized patch batches", async () => {
    const deletePaths = Array.from({ length: 201 }, (_, idx) => `file-${idx}.txt`);
    const patch: PreflightPatch = {
      delete: deletePaths,
    };

    await expect(applyPreflightPatch([], patch)).rejects.toThrow("ueberschreiten das Limit");
  });
});

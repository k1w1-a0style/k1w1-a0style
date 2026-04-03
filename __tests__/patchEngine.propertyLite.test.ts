import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";
import type { ProjectFile } from "../shared/types/project";
import type { PreflightPatch } from "../lib/diagnostics/preflightTypes";

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function randomInt(rand: () => number, maxExclusive: number): number {
  return Math.floor(rand() * maxExclusive);
}

function buildRandomFiles(seed: number, count: number): ProjectFile[] {
  const rand = createSeededRandom(seed);
  const out: ProjectFile[] = [];
  for (let i = 0; i < count; i += 1) {
    const n = randomInt(rand, 1000);
    out.push({ path: `src/file-${i}-${n}.txt`, content: `content-${n}` });
  }
  return out;
}

function buildRandomPatch(seed: number, fileCount: number): PreflightPatch {
  const rand = createSeededRandom(seed);
  const deleteCount = 5;
  const upsertCount = 8;

  const deletePaths = Array.from({ length: deleteCount }, () => `src/file-${randomInt(rand, fileCount)}-${randomInt(rand, 1000)}.txt`);
  const upserts = Array.from({ length: upsertCount }, (_, idx) => ({
    path: `src/new-${idx}-${randomInt(rand, 5000)}.txt`,
    content: `patched-${randomInt(rand, 100000)}`,
  }));

  return {
    delete: deletePaths,
    upsert: upserts,
  };
}

describe("patch engine property-lite checks", () => {
  it("keeps empty patch as identity", async () => {
    const files = buildRandomFiles(101, 20);
    const next = await applyPreflightPatch(files, {});
    expect(next).toEqual(files);
  });

  it("is deterministic for same input", async () => {
    const files = buildRandomFiles(2026, 25);
    const patch = buildRandomPatch(77, 25);

    const first = await applyPreflightPatch(files, patch);
    const second = await applyPreflightPatch(files, patch);

    expect(second).toEqual(first);
  });

  it("never returns duplicate paths", async () => {
    const files = buildRandomFiles(404, 30);
    const patch = buildRandomPatch(909, 30);
    const next = await applyPreflightPatch(files, patch);

    const pathSet = new Set(next.map((f) => f.path));
    expect(pathSet.size).toBe(next.length);
  });
});

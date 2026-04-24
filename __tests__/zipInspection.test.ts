import { inspectZipArchiveBytes } from "../infra/storage/zipInspection";

type EntrySpec = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
};

function writeUint16LE(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function buildCentralDirectoryZip(entries: EntrySpec[]): Uint8Array {
  const encoder = new TextEncoder();
  const centralEntries = entries.map((entry, index) => {
    const nameBytes = encoder.encode(entry.name);
    const out = new Uint8Array(46 + nameBytes.length);
    writeUint32LE(out, 0, 0x02014b50);
    writeUint16LE(out, 4, 20);
    writeUint16LE(out, 6, 20);
    writeUint16LE(out, 8, 0);
    writeUint16LE(out, 10, 8);
    writeUint16LE(out, 12, 0);
    writeUint16LE(out, 14, 0);
    writeUint32LE(out, 16, 0);
    writeUint32LE(out, 20, entry.compressedSize >>> 0);
    writeUint32LE(out, 24, entry.uncompressedSize >>> 0);
    writeUint16LE(out, 28, nameBytes.length);
    writeUint16LE(out, 30, 0);
    writeUint16LE(out, 32, 0);
    writeUint16LE(out, 34, 0);
    writeUint16LE(out, 36, 0);
    writeUint32LE(out, 38, entry.name.endsWith("/") ? 0x10 : 0);
    writeUint32LE(out, 42, index * 30);
    out.set(nameBytes, 46);
    return out;
  });

  const centralSize = centralEntries.reduce((sum, entry) => sum + entry.length, 0);
  const eocd = new Uint8Array(22);
  writeUint32LE(eocd, 0, 0x06054b50);
  writeUint16LE(eocd, 4, 0);
  writeUint16LE(eocd, 6, 0);
  writeUint16LE(eocd, 8, entries.length);
  writeUint16LE(eocd, 10, entries.length);
  writeUint32LE(eocd, 12, centralSize);
  writeUint32LE(eocd, 16, 0);
  writeUint16LE(eocd, 20, 0);

  const out = new Uint8Array(centralSize + eocd.length);
  let cursor = 0;
  for (const entry of centralEntries) {
    out.set(entry, cursor);
    cursor += entry.length;
  }
  out.set(eocd, cursor);
  return out;
}

describe("zipInspection pre-unzip archive validation", () => {
  it("accepts a small allowed archive from central directory metadata", () => {
    const result = inspectZipArchiveBytes(
      buildCentralDirectoryZip([{ name: "components/App.tsx", compressedSize: 120, uncompressedSize: 320 }]),
      { maxEntries: 10, maxFileBytes: 1024 * 1024, maxTotalUncompressedBytes: 5 * 1024 * 1024 },
    );

    expect(result.valid).toBe(true);
    expect(result.entries).toEqual([
      expect.objectContaining({ path: "components/App.tsx", uncompressedBytes: 320 }),
    ]);
    expect(result.totalUncompressedBytes).toBe(320);
  });

  it("rejects path traversal entries before unzip", () => {
    const result = inspectZipArchiveBytes(
      buildCentralDirectoryZip([{ name: "../../etc/passwd", compressedSize: 10, uncompressedSize: 10 }]),
      { maxEntries: 10, maxFileBytes: 1024 * 1024, maxTotalUncompressedBytes: 5 * 1024 * 1024 },
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("ZIP-Metadatenprüfung fehlgeschlagen");
    expect(result.issues).toEqual([
      expect.objectContaining({ path: "../../etc/passwd" }),
    ]);
  });

  it("rejects absolute/Windows/UNC/file path entries before unzip", () => {
    const result = inspectZipArchiveBytes(
      buildCentralDirectoryZip([
        { name: "/src/App.tsx", compressedSize: 10, uncompressedSize: 20 },
        { name: "C:/temp/evil.ts", compressedSize: 10, uncompressedSize: 20 },
        { name: "//server/share/evil.ts", compressedSize: 10, uncompressedSize: 20 },
        { name: "file:///tmp/evil.ts", compressedSize: 10, uncompressedSize: 20 },
      ]),
      { maxEntries: 20, maxFileBytes: 1024 * 1024, maxTotalUncompressedBytes: 5 * 1024 * 1024 },
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("ZIP-Metadatenprüfung fehlgeschlagen");
    expect(result.issues).toHaveLength(4);
    expect(result.issues.every((issue) => issue.reason.includes("absoluter/Windows/UNC/file:-Pfad"))).toBe(true);
  });



  it("rejects duplicate normalized file paths before unzip", () => {
    const result = inspectZipArchiveBytes(
      buildCentralDirectoryZip([
        { name: "components/App.tsx", compressedSize: 120, uncompressedSize: 320 },
        { name: "components/App.tsx", compressedSize: 90, uncompressedSize: 180 },
      ]),
      { maxEntries: 10, maxFileBytes: 1024 * 1024, maxTotalUncompressedBytes: 5 * 1024 * 1024 },
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "components/App.tsx", reason: "Duplizierter Dateipfad im Archiv" }),
      ]),
    );
  });

  it("rejects archives whose uncompressed payload is too large before unzip", () => {
    const result = inspectZipArchiveBytes(
      buildCentralDirectoryZip([{ name: "src/big.ts", compressedSize: 5_000, uncompressedSize: 30 * 1024 * 1024 }]),
      { maxEntries: 10, maxFileBytes: 40 * 1024 * 1024, maxTotalUncompressedBytes: 25 * 1024 * 1024 },
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("ZIP entpackt zu viele Daten (30.00MB > 25.00MB)");
  });
});

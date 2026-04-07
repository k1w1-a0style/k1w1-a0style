import fs from "fs";
import path from "path";

describe("disabled edge functions keep verify_jwt=true defaults", () => {
  it("ensures disabled functions in supabase/config.toml are not left with verify_jwt=false", () => {
    const cfg = fs.readFileSync(path.join(process.cwd(), "supabase/config.toml"), "utf8");
    const blocks = cfg.split(/\n\[(?=functions\.)/g).map((b) => (b.startsWith("[functions.") ? b : `[${b}`));

    const offenders: string[] = [];
    for (const block of blocks) {
      const headerMatch = block.match(/^\[functions\.([^\]]+)\]/m);
      if (!headerMatch) continue;
      const name = headerMatch[1];
      const enabledFalse = /\benabled\s*=\s*false\b/.test(block);
      const verifyFalse = /\bverify_jwt\s*=\s*false\b/.test(block);
      if (enabledFalse && verifyFalse) {
        offenders.push(name);
      }
    }

    expect(offenders).toEqual([]);
  });
});

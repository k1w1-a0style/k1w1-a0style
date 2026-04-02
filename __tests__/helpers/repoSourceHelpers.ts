import fs from "fs";
import path from "path";

export function readRepoText(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

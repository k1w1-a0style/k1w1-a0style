import type { ChecklistItem } from "../templateChecklistTypes";
import type { Toolchain } from "../toolchain";
import { ensureObj, majorOf, upsertDep } from "../jsonUtils";

export function patchPackageJson(
  raw: string,
  toolchain: Toolchain,
): {
  next: string;
  changed: boolean;
  parseOk: boolean;
  parseError?: string;
  p0: ChecklistItem[];
} {
  const p0: ChecklistItem[] = [];
  let changed = false;

  try {
    const pkg = JSON.parse(raw || "{}");
    if (!pkg || typeof pkg !== "object") throw new Error("not object");

    pkg.dependencies = ensureObj(pkg.dependencies);
    pkg.devDependencies = ensureObj(pkg.devDependencies);
    pkg.scripts = ensureObj(pkg.scripts);

    // required scripts
    const requiredScripts: Record<string, string> = {
      start: "expo start",
      android: "expo start --android",
      typecheck: "tsc --noEmit",
      "lint:ci": "eslint . --quiet",
      "test:silent": "jest --runInBand",
    };

    for (const [k, v] of Object.entries(requiredScripts)) {
      if (typeof pkg.scripts[k] !== "string" || !pkg.scripts[k]) {
        pkg.scripts[k] = v;
        changed = true;
      }
    }

    // required deps
    changed = upsertDep(pkg.dependencies, "expo", toolchain.expo) || changed;
    changed = upsertDep(pkg.dependencies, "react", toolchain.react) || changed;
    changed = upsertDep(pkg.dependencies, "react-native", toolchain.reactNative) || changed;

    // For preview/web tooling – harmless even on Android-only (doesn't affect native build)
    if (typeof pkg.dependencies["react-dom"] !== "string") {
      pkg.dependencies["react-dom"] = toolchain.reactDom;
      changed = true;
    }

    // required dev deps
    if (typeof pkg.devDependencies["jest-expo"] !== "string") {
      pkg.devDependencies["jest-expo"] = toolchain.jestExpo;
      changed = true;
    }
    if (typeof pkg.devDependencies["typescript"] !== "string") {
      pkg.devDependencies["typescript"] = "^5.8.0";
      changed = true;
    }
    if (typeof pkg.devDependencies["@types/react"] !== "string") {
      pkg.devDependencies["@types/react"] = "^19.0.0";
      changed = true;
    }

    // sanity: expo/react/rn majors
    const majExpo = majorOf(pkg.dependencies["expo"]);
    const majReact = majorOf(pkg.dependencies["react"]);
    const majRN = majorOf(pkg.dependencies["react-native"]);
    if (majExpo !== 54) {
      p0.push({
        severity: "P0",
        file: "package.json",
        reason: `Expo SDK Mismatch (expo=${String(pkg.dependencies["expo"])}; erwartet 54.x)`,
        fix: `Setze expo auf ${toolchain.expo}`,
      });
    }
    if (majReact !== 19) {
      p0.push({
        severity: "P0",
        file: "package.json",
        reason: `React Mismatch (react=${String(pkg.dependencies["react"])}; erwartet 19.x)`,
        fix: `Setze react auf ${toolchain.react}`,
      });
    }
    if (majRN !== 0 || !String(pkg.dependencies["react-native"] ?? "").includes("0.81")) {
      p0.push({
        severity: "P0",
        file: "package.json",
        reason: `React-Native Mismatch (react-native=${String(pkg.dependencies["react-native"])}; erwartet 0.81.x)`,
        fix: `Setze react-native auf ${toolchain.reactNative}`,
      });
    }

    const next = JSON.stringify(pkg, null, 2);
    return { next, changed, parseOk: true, p0 };
  } catch (e: any) {
    // fallback minimal package.json
    const fallback = {
      name: "app",
      version: "1.0.0",
      main: "index.js",
      scripts: {
        start: "expo start",
        android: "expo start --android",
        typecheck: "tsc --noEmit",
        "lint:ci": "eslint . --quiet",
        "test:silent": "jest --runInBand",
      },
      dependencies: {
        expo: toolchain.expo,
        react: toolchain.react,
        "react-native": toolchain.reactNative,
        "react-dom": toolchain.reactDom,
      },
      devDependencies: {
        "jest-expo": toolchain.jestExpo,
        typescript: "^5.8.0",
        "@types/react": "^19.0.0",
      },
    };
    return {
      next: JSON.stringify(fallback, null, 2),
      changed: true,
      parseOk: false,
      parseError: e?.message ? String(e.message) : "parse failed",
      p0,
    };
  }
}


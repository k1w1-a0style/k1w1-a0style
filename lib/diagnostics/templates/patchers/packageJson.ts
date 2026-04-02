import type { ChecklistItem } from "../templateChecklistTypes";
import type { Toolchain } from "../toolchain";
import { ensureObj, getErrorMessage, isJsonRecord, majorOf, upsertDep } from "../jsonUtils";

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
    const parsed: unknown = JSON.parse(raw || "{}");
    if (!isJsonRecord(parsed)) throw new Error("not object");
    const pkg = parsed;

    const dependencies = ensureObj(pkg.dependencies);
    const devDependencies = ensureObj(pkg.devDependencies);
    const scripts = ensureObj(pkg.scripts);
    pkg.dependencies = dependencies;
    pkg.devDependencies = devDependencies;
    pkg.scripts = scripts;

    // required scripts
    const requiredScripts: Record<string, string> = {
      start: "expo start",
      android: "expo start --android",
      typecheck: "tsc --noEmit",
      "lint:ci": "eslint . --quiet",
      "test:silent": "jest --runInBand",
    };

    for (const [k, v] of Object.entries(requiredScripts)) {
      if (typeof scripts[k] !== "string" || !scripts[k]) {
        scripts[k] = v;
        changed = true;
      }
    }

    // required deps
    changed = upsertDep(dependencies, "expo", toolchain.expo) || changed;
    changed = upsertDep(dependencies, "react", toolchain.react) || changed;
    changed = upsertDep(dependencies, "react-native", toolchain.reactNative) || changed;

    // For preview/web tooling – harmless even on Android-only (doesn't affect native build)
    if (typeof dependencies["react-dom"] !== "string") {
      dependencies["react-dom"] = toolchain.reactDom;
      changed = true;
    }

    // required dev deps
    if (typeof devDependencies["jest-expo"] !== "string") {
      devDependencies["jest-expo"] = toolchain.jestExpo;
      changed = true;
    }
    if (typeof devDependencies["typescript"] !== "string") {
      devDependencies["typescript"] = "^5.8.0";
      changed = true;
    }
    if (typeof devDependencies["@types/react"] !== "string") {
      devDependencies["@types/react"] = "^19.0.0";
      changed = true;
    }

    // sanity: expo/react/rn majors
    const expoDep = dependencies["expo"];
    const reactDep = dependencies["react"];
    const reactNativeDep = dependencies["react-native"];
    const majExpo = majorOf(expoDep);
    const majReact = majorOf(reactDep);
    const majRN = majorOf(reactNativeDep);
    if (majExpo !== 54) {
      p0.push({
        severity: "P0",
        file: "package.json",
        reason: `Expo SDK Mismatch (expo=${String(expoDep)}; erwartet 54.x)`,
        fix: `Setze expo auf ${toolchain.expo}`,
      });
    }
    if (majReact !== 19) {
      p0.push({
        severity: "P0",
        file: "package.json",
        reason: `React Mismatch (react=${String(reactDep)}; erwartet 19.x)`,
        fix: `Setze react auf ${toolchain.react}`,
      });
    }
    if (majRN !== 0 || !String(reactNativeDep ?? "").includes("0.81")) {
      p0.push({
        severity: "P0",
        file: "package.json",
        reason: `React-Native Mismatch (react-native=${String(reactNativeDep)}; erwartet 0.81.x)`,
        fix: `Setze react-native auf ${toolchain.reactNative}`,
      });
    }

    const next = JSON.stringify(pkg, null, 2);
    return { next, changed, parseOk: true, p0 };
  } catch (error: unknown) {
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
      parseError: getErrorMessage(error),
      p0,
    };
  }
}

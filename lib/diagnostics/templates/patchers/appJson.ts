import type { ChecklistItem } from "../templateChecklistTypes";
import { ensureObj, getErrorMessage } from "../jsonUtils";
import { minimalAppJson } from "../defaults";

export function patchAppJson(
  raw: string,
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
    const obj = ensureObj(JSON.parse(raw || "{}"));
    const expo = ensureObj(obj.expo);

    // Android-only policy
    if (!Array.isArray(expo.platforms) || expo.platforms.join(",") !== "android") {
      expo.platforms = ["android"];
      changed = true;
    }

    if (expo.newArchEnabled !== true) {
      expo.newArchEnabled = true;
      changed = true;
    }

    const expoAndroid = ensureObj(expo.android);
    if (typeof expoAndroid.package !== "string" || expoAndroid.package.trim().length < 8) {
      p0.push({
        severity: "P0",
        file: "app.json",
        reason: "expo.android.package fehlt oder ist ungültig (mind. com.x.y).",
        fix: "Setze package via UI/Generator (z.B. com.k1w1.app).",
      });
    }

    // Ensure referenced assets exist (paths only; existence checked elsewhere)
    if (typeof expo.icon !== "string") {
      expo.icon = "./assets/icon.png";
      changed = true;
    }
    const splash = ensureObj(expo.splash);
    if (typeof splash.image !== "string") {
      splash.image = "./assets/splash.png";
      changed = true;
    }
    if (typeof splash.resizeMode !== "string") {
      splash.resizeMode = "contain";
      changed = true;
    }
    if (typeof splash.backgroundColor !== "string") {
      splash.backgroundColor = "#ffffff";
      changed = true;
    }

    const adaptiveIcon = ensureObj(expoAndroid.adaptiveIcon);
    if (typeof adaptiveIcon.foregroundImage !== "string") {
      adaptiveIcon.foregroundImage = "./assets/adaptive-icon.png";
      changed = true;
    }
    if (typeof adaptiveIcon.backgroundColor !== "string") {
      adaptiveIcon.backgroundColor = "#ffffff";
      changed = true;
    }

    expoAndroid.adaptiveIcon = adaptiveIcon;
    expo.android = expoAndroid;
    expo.splash = splash;
    obj.expo = expo;

    const next = JSON.stringify(obj, null, 2);
    return { next, changed, parseOk: true, p0 };
  } catch (error: unknown) {
    const next = JSON.stringify(minimalAppJson(), null, 2);
    return {
      next,
      changed: true,
      parseOk: false,
      parseError: getErrorMessage(error),
      p0,
    };
  }
}

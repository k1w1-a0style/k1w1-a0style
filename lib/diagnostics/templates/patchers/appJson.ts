import type { ChecklistItem } from "../templateChecklistTypes";
import { ensureObj } from "../jsonUtils";
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
    const obj = JSON.parse(raw || "{}");
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

    expo.android = ensureObj(expo.android);
    if (typeof expo.android.package !== "string" || expo.android.package.trim().length < 8) {
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
    expo.splash = ensureObj(expo.splash);
    if (typeof expo.splash.image !== "string") {
      expo.splash.image = "./assets/splash.png";
      changed = true;
    }
    if (typeof expo.splash.resizeMode !== "string") {
      expo.splash.resizeMode = "contain";
      changed = true;
    }
    if (typeof expo.splash.backgroundColor !== "string") {
      expo.splash.backgroundColor = "#ffffff";
      changed = true;
    }

    expo.android.adaptiveIcon = ensureObj(expo.android.adaptiveIcon);
    if (typeof expo.android.adaptiveIcon.foregroundImage !== "string") {
      expo.android.adaptiveIcon.foregroundImage = "./assets/adaptive-icon.png";
      changed = true;
    }
    if (typeof expo.android.adaptiveIcon.backgroundColor !== "string") {
      expo.android.adaptiveIcon.backgroundColor = "#ffffff";
      changed = true;
    }

    obj.expo = expo;
    const next = JSON.stringify(obj, null, 2);
    return { next, changed, parseOk: true, p0 };
  } catch (e: any) {
    const next = JSON.stringify(minimalAppJson(), null, 2);
    return {
      next,
      changed: true,
      parseOk: false,
      parseError: e?.message ? String(e.message) : "parse failed",
      p0,
    };
  }
}


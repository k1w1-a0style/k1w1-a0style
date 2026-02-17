import type { ChecklistItem } from "../templateChecklistTypes";

export function patchAppConfigJs(
  raw: string,
  autofix: boolean,
): { next: string; changed: boolean; p0: ChecklistItem[]; p1: ChecklistItem[] } {
  const p0: ChecklistItem[] = [];
  const p1: ChecklistItem[] = [];
  let out = raw || "";
  let changed = false;

  // 1) platforms: ['android'] is REQUIRED for this project (Android-only policy)
  if (/\bplatforms\s*:\s*\[[^\]]*\]/m.test(out)) {
    const next = out.replace(/\bplatforms\s*:\s*\[[^\]]*\]/m, "platforms: ['android']");
    if (next !== out) {
      out = next;
      changed = true;
    }
  } else {
    const msg: ChecklistItem = {
      severity: "P0",
      file: "app.config.js",
      reason: "Android-only Policy: platforms fehlt in app.config.js",
      fix: "platforms: ['android'] ergänzen.",
    };
    if (autofix) {
      // Insert right after `expo: {`
      const next = out.replace(/\bexpo\s*:\s*\{/m, (s) => `${s}\n    platforms: ['android'],`);
      if (next !== out) {
        out = next;
        changed = true;
      } else {
        // If insertion failed (unexpected structure), keep as P0
        p0.push(msg);
      }
    } else {
      p0.push(msg);
    }
  }

  // 2) newArchEnabled: true (recommended, but we enforce to avoid drift)
  if (/\bnewArchEnabled\s*:\s*false\b/m.test(out)) {
    out = out.replace(/\bnewArchEnabled\s*:\s*false\b/m, "newArchEnabled: true");
    changed = true;
  } else if (!/\bnewArchEnabled\s*:\s*true\b/m.test(out)) {
    const msg: ChecklistItem = {
      severity: "P1",
      file: "app.config.js",
      reason: "newArchEnabled nicht gefunden – SDK54 empfohlen.",
      fix: "newArchEnabled: true setzen.",
    };
    if (autofix) {
      const next = out.replace(/\bexpo\s*:\s*\{/m, (s) => `${s}\n    newArchEnabled: true,`);
      if (next !== out) {
        out = next;
        changed = true;
      } else {
        p1.push(msg);
      }
    } else {
      p1.push(msg);
    }
  }

  // 3) icon: './assets/icon.png'
  if (!/\bicon\s*:\s*['"][^'"]+['"]/m.test(out)) {
    const msg: ChecklistItem = {
      severity: "P1",
      file: "app.config.js",
      reason: "icon fehlt – Expo/EAS kann Assets nicht finden.",
      fix: "icon: './assets/icon.png' ergänzen.",
    };
    if (autofix) {
      const next = out.replace(/\bexpo\s*:\s*\{/m, (s) => `${s}\n    icon: './assets/icon.png',`);
      if (next !== out) {
        out = next;
        changed = true;
      } else {
        p1.push(msg);
      }
    } else {
      p1.push(msg);
    }
  }

  // 4) splash.image: './assets/splash.png' (ensure if splash block exists)
  if (/\bsplash\s*:\s*\{/m.test(out) && !/\bsplash\s*:\s*\{[\s\S]*?\bimage\s*:/m.test(out)) {
    const msg: ChecklistItem = {
      severity: "P1",
      file: "app.config.js",
      reason: "splash.image fehlt – Preview/Build kann inkonsistent sein.",
      fix: "splash: { image: './assets/splash.png', ... } ergänzen.",
    };
    if (autofix) {
      const next = out.replace(/\bsplash\s*:\s*\{/m, (s) => `${s}\n      image: './assets/splash.png',`);
      if (next !== out) {
        out = next
        changed = true;
      } else {
        p1.push(msg);
      }
    } else {
      p1.push(msg);
    }
  }

  // 5) android.adaptiveIcon.foregroundImage
  if (/\badaptiveIcon\s*:\s*\{/m.test(out) && !/\badaptiveIcon\s*:\s*\{[\s\S]*?\bforegroundImage\s*:/m.test(out)) {
    const msg: ChecklistItem = {
      severity: "P1",
      file: "app.config.js",
      reason: "android.adaptiveIcon.foregroundImage fehlt – AdaptiveIcon kann fehlen.",
      fix: "foregroundImage: './assets/adaptive-icon.png' ergänzen.",
    };
    if (autofix) {
      const next = out.replace(/\badaptiveIcon\s*:\s*\{/m, (s) => `${s}\n        foregroundImage: './assets/adaptive-icon.png',`);
      if (next !== out) {
        out = next
        changed = true;
      } else {
        p1.push(msg);
      }
    } else {
      p1.push(msg);
    }
  }

  // 6) android.package required (can't safely fix automatically)
  if (!/\bpackage\s*:\s*['"][a-z0-9.]+['"]/m.test(out)) {
    p0.push({
      severity: "P0",
      file: "app.config.js",
      reason: "expo.android.package fehlt oder ist nicht erkennbar.",
      fix: "android: { package: 'com.yourcompany.app' } setzen.",
    });
  }

  return { next: out, changed, p0, p1 };
}


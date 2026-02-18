# PATCH 39 HOTFIX 1 — React Native type shadowing fix

## Problem
After applying **PATCH 39** (gap typing cleanup), TypeScript can suddenly explode with errors like:

- `Module '"react-native"' has no exported member 'View' / 'Text' / ...`
- missing props on common components (e.g. `style` on SafeAreaView/WebView)

Root cause: the local file `types/react-native-gap.d.ts` used `declare module "react-native" { ... }`. In some TS setups, that can *shadow* the real `react-native` declarations (instead of augmenting them), so TS thinks `react-native` only exports the tiny stuff we declared.

## Fix
We avoid touching the public `react-native` module and instead augment the internal declaration module where `FlexStyle` is defined:

- `react-native/Libraries/StyleSheet/StyleSheetTypes`

This provides `gap/rowGap/columnGap` typings **without** risking shadowing.

## Files changed
- `types/react-native-gap.d.ts`

## How to apply
```bash
unzip -o k1w1-a0style_patch_39_hotfix1_reactnative_types.zip -d .
rm -f k1w1-a0style_patch_39_hotfix1_reactnative_types.zip

npm run typecheck
npm run lint:ci
npm run test:silent
```

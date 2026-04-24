# Patch 785 - Audit Dependency Rest Triage

Datum: 2026-04-24

## Scope
- Prompt 2: Audit-/Dependency-Rest sauber triagieren (enger Scope, keine Broad-Refactors).

## Ausgangslage
- `npm audit --json` zeigte 17 **moderate** Findings, 0 high/critical.
- Im installierten Tree lag `@xmldom/xmldom@0.9.9` als invalider Rest vor (`@expo/plist` verlangt `^0.9.10`).

## Umsetzung
- Minimaler Dependency-Abgleich ohne `npm audit fix --force` und ohne Major-Upgrade:
  - `npm install` ausgefuehrt, damit vorhandene `overrides` konsistent im Lock-/Install-Tree greifen.
- Danach validiert:
  - `npm ls @xmldom/xmldom` zeigt nur noch `0.9.10` (deduped), kein invalider Rest.
  - `npm audit --json` bleibt bei 17 moderaten Expo-/RN-nahen Findings, 0 high/critical.

## Audit-Triage Endstand

### Direkt geschlossen
- `@xmldom/xmldom` High-Restpunkt: geschlossen (0.9.10 aktiv im Tree).

### Verbleibende Findings (bewusst nicht im Scope gefixt)
1. **Expo-/React-Native transitive Kette**
   - Betroffen: `expo`, `@expo/*`, `expo-asset`, `expo-constants`, `expo-dev-client`, `expo-notifications`, `expo-updates`, `jest-expo`, `xcode`, `postcss`.
   - Grund: npm meldet als Fixpfad semver-major Spruenge auf andere Expo-Linien; im aktuellen Scope explizit nicht erlaubt.
2. **`uuid` advisory (`<14`)**
   - Direkter Fix waere `uuid@14` (semver major) und wuerde transitive Expo-/xcode-Aufloesung beruehren.
   - Daher im aktuellen Scope als temporärer Nicht-Blocker dokumentiert.

## Risikobewertung
- Kein neues Runtime-/Build-Risiko eingefuehrt (kein Framework-/Major-Upgrade).
- Lockfile-Wildwuchs vermieden; nur notwendiger Konsistenz-Nachzug fuer bestehende Override-Policy.

## Folgeempfehlung (ein naechster Block)
- Separater, geplanter Expo-/RN-Upgrade-Block mit dediziertem Regressionstestplan, um verbleibende moderate Findings strukturiert abzubauen.

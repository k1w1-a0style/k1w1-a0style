# Patch 670 - Refactor-Durchlauf 30 (navigation typing cluster)

## Ziel

Die letzten verbliebenen lokalen `useNavigation<any>()` / `useRoute<any>()`-Signaturen in produktiven Screens helper-first entfernen, ohne Screen-/Flow-/Build-Vertraege umzubauen.

## Umgesetzt

- `screens/ChatScreen/hooks/useChatScreen.ts` nutzt jetzt getypte Chat-Route-/Navigation-Parameter statt `useNavigation<any>()` / `useRoute<any>()`.
- `screens/DiagnosticScreen/index.tsx` verwendet einen getypten `DiagnosticRoute`-Vertrag plus `NavigationProp<ParamListBase>`.
- `screens/EnhancedBuildScreen/index.tsx` verwendet `NavigationProp<ParamListBase>` statt `useNavigation<any>()`.

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Hinweis

Es wurde bewusst nur der screen-/route-nahe Typing-Block nachgezogen; keine Navigation- oder Flow-Logik wurde geaendert.

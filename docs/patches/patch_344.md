# Patch 344 – Diagnostics EAS-Link Workflow Detection + SafeArea Harmonization

## Ziel
- EAS-Link Fehlerzustand robust gegen `.yml`/`.yaml` Varianten machen.
- SafeArea-Verhalten im Diagnostic Screen und weiteren Hauptscreens konsistent auf Top/Bottom/Side Insets harmonisieren.
- Regression-Test für DiagnosticScreen-Sorting nach SafeArea-Hook-Einführung stabil halten.

## Änderungen
1. **Diagnostics / EAS-Link Check**
   - `repo.workflow.easLink` akzeptiert jetzt `eas-link.yml` **oder** `eas-link.yaml`.
   - Titel/FixHint entsprechend präzisiert.

2. **Diagnostic Screen SafeArea**
   - `DiagnosticScreen` nutzt `SafeAreaView` + `useSafeAreaInsets`.
   - Header erhält `topInset`-basiertes Padding.
   - Scroll-Content bekommt dynamisches `paddingBottom` (`insets.bottom + 24`) für sichtbare Toast/Fix-Feedbacks.

3. **SafeArea-Angleichung auf mehreren Screens**
   - Vollständige Edge-Abdeckung (`top`, `bottom`, `left`, `right`) für:
     - AppStatus, Chat, Code, Connections, CredentialsWizard,
     - EnhancedBuild, GitHubRepos, Settings.

4. **Test-Fix**
   - `__tests__/diagnosticScreen.sorting.test.tsx` mockt nun `react-native-safe-area-context` (`SafeAreaView`, `useSafeAreaInsets`) zur Vermeidung von Context-Fehlern.

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

Alle drei Checks erfolgreich.

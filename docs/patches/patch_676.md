# Patch 676 — Refactor-Durchlauf 36 (targeted test utilities + notification/retry fixtures)

## Ziel
Einen kleinen weiteren Test-/Mock-Debt-Block helper-first reduzieren, ohne Produktcode oder Vertragslogik zu oeffnen.

## Umsetzung
- `lib/__tests__/notificationService.test.ts` nutzt jetzt einen getypten `NotificationServiceInternals`-View sowie `jest.Mocked<typeof Notifications>` statt `notificationService as any`-/`mockExpoConstants: any`-/Mock-Call-`any`-Zugriffen.
- `lib/__tests__/retryWithBackoff.test.ts` kapselt Retry-Tagging helper-first ueber `RetryableTestError` und `shouldRetryTaggedError(...)` statt `(error as any).retryable`.
- `__tests__/useNotifications.permissions.regression.test.tsx` mockt `initialize`/`getPushToken` direkt ohne Spread-`any[]`.

## Wirkung
- kleiner weiterer Test-/Mock-Debt-Abbau
- keine Produkt-/Runtime-/Contract-Aenderung
- verbleibender Debt konzentriert sich jetzt auf breitere contract-/mock-nahe Testdateien

## Validierung
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

# Patch 256: tests for key-based secret redaction

## Summary
Adds a regression test ensuring `sanitizeUnknownForTransport()` redacts values for sensitive keys (e.g. `token`, `authorization`, `apiKey`) even when the values are short and would not match regex-based secret patterns.

## Why
Patch 255 introduced key-based redaction to prevent accidental leakage of short secrets in error `details`. This test prevents regressions.

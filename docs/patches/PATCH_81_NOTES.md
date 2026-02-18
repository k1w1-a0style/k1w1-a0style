# Patch 81 Notes

## Scope
SettingsScreen security hardening: prevent API-key leakage in UI.

## Changes
- Mask stored API keys by default; per-key reveal toggle (eye).
- New API-key input now uses secureTextEntry by default; eye toggle to reveal.
- Basic provider-aware key validation (prefix/length/whitespace).
- Sanitize error messages for key actions using existing secret redaction helper.

## UI impact
- **Visible change**: API keys are no longer shown in clear text by default.
- Input field is masked while typing unless explicitly revealed.


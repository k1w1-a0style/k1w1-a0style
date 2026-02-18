Patch 57 hardens CodeScreen (Android-only) without changing layout:
- Awaited and validated folder creation (.gitkeep) + duplicate file creation; added simple action lock to prevent double-tap races.
- Added navigation + hardware-back guards for unsaved edits (beforeRemove + BackHandler).
- Hardened WebView originWhitelist (about:blank + data:* only).
- Added safe export cap (~2 MiB) and streaming build to avoid OOM.
- Added save-time validation skip prompt for very large files to avoid UI hangs.

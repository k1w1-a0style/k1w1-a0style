# Patch 274: UX + diagnostics polish

## What changed

- Chat UI:
  - Send button and scroll-to-bottom button are now visually consistent (icon colors no longer blend into the background).
  - Removed the tiny keyboard gap by setting the chat keyboard nudge to 0.

- Connections:
  - Long labels (e.g. Service Role Key) now wrap instead of overflowing.
  - EAS status now validates the Project ID format (UUID) instead of just checking non-empty.

- CI Lite:
  - Progress bar fill is clamped to 0–100% to avoid overflow when the animated value overshoots.

- Repo selection:
  - Repo list is shown by default (so it doesn’t feel “hardcoded”).

## Notes

- CI Lite 404/502 dispatch errors are usually caused by missing workflows in the *target repo* (e.g. `.github/workflows/ci-lite.yml`) or missing permissions. This patch doesn’t create workflows in the external repo automatically; it improves in-app visibility and avoids UI glitches.

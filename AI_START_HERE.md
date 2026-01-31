# AI START HERE — Mobile APK Builder

This repository contains the **Mobile APK Builder** app.

If you are an AI/agent (ChatGPT, Codex, Cursor, etc.) working on this repo, do this **before editing anything**:

1) Read **PROJECT_CONTEXT.md** (what the product is, key flows, constraints).
2) Read **AGENTS.md** (non‑negotiable rules, what NOT to change).
3) When touching anything under `.github/workflows/` or the files the app pushes into target repos, treat them as **production**.

## What this app does
- User enters **tokens / API keys** (GitHub, Expo/EAS, Supabase, etc.) in the app.
- The app can **create / bootstrap** a target repository (or connect to an existing one).
- It **pushes GitHub Actions workflows + config** into that target repo.
- It triggers builds on demand (development / preview / production) and shows build status.

## “If you change X, you must also check Y”
- If you change build automation (workflows, templates): verify **all 3 profiles** still work.
- If you change credential logic: verify **non‑interactive CI** still works (no prompts).
- If you change repo/branch selection logic: verify **branch is user‑selectable**, persisted, and **not pinned** in workflows.

## Key terms
- **Builder app**: this repo.
- **Target repo**: the repo chosen in the app where workflows get pushed and builds run.
- **EAS**: Expo Application Services build system.


# Patch 190 — One-Click Deploy: Signing Key enforcement + whitespace cleanup

Date: 2026-02-19

## Goals
- Make Signing-Key rule consistent across Build checklist and One-Click Deploy.
- Remove accidental tabs/whitespace noise in a few touched files.

## Changes
- One-Click Deploy now **fails hard** when the Signing Key is missing (no "skip").
- Whitespace cleanup (tabs -> spaces) in EnhancedBuildScreen hook + DiffFilesSection.

## Files
- screens/EnhancedBuildScreen/hooks/useOneClickDeploy.ts
- screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts
- screens/GitHubReposScreen/components/DiffFilesSection.tsx

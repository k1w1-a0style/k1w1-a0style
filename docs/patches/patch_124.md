# Patch 124

Expose EAS link controls in Repo screen.

Files:
- screens/GitHubReposScreen/index.tsx

UI:
- shows stored EAS Project ID
- Check: verify .github/workflows/eas-link.yml exists
- Link: create/update .github/workflows/eas-link.yml with that ID

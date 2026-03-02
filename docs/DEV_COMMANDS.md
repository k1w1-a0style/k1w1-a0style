# Developer Commands

This file collects the most useful terminal commands for working on this repo (without requiring extra tools like `rg`).

## Run checks

```bash
npm run test:silent
npm run typecheck
npm run lint:ci
```

## Search the codebase

### Prefer `git grep` (fast, always available in git repos)

```bash
# Find a string (case-sensitive)
git grep -n "diagnostic_last_ok"

# Case-insensitive
 git grep -n -i "supabase"

# Regex
 git grep -n -E "Platform\\.OS|expo"
```

### Fallback to `grep` (works everywhere)

```bash
# Recursive + line numbers
grep -RIn "diagnostic_last_ok" .

# Multiple patterns (extended regex)
grep -RIn -E "supabase\\.co/functions/v1|SUPABASE_EDGE_FUNCTIONS" .

# Limit to TS/TSX
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | xargs -0 grep -n "trigger-eas-build"
```

## Patch apply template

```bash
# 1) ZIP entpacken
unzip -o <patch_zip_name>.zip -d .

# 2) ZIP löschen
rm -f <patch_zip_name>.zip

# 3) Checks
npm run test:silent

# 4) Commit + Push
git add -A
git commit -m "<message>"
git push
```


## Docs checks

```bash
npm run docs:lint
```

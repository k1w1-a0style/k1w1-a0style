# Patch 361 — github-workflow-dispatch bundling fix (GitHub expressions)

## Problem
Beim Deploy von `supabase/functions/github-workflow-dispatch` schlug das Bundling fehl mit:

- `Expected ',', got '.' ... ${{ github.ref_name }}`

Grund: In den YAML-Templates wurden GitHub-Expressions wie `${{ github.ref_name }}` **ohne Escape** innerhalb eines TypeScript Template-Literals verwendet. Dadurch interpretiert der Parser das als JS-Interpolation und scheitert.

## Fix
- In `supabase/functions/github-workflow-dispatch/index.ts` alle **unescaped** GitHub-Expressions in Template-Strings zu literalem Text gemacht:
  - `${{ ... }}` → `\${{ ... }}`

Damit bleibt die Expression im YAML erhalten, aber TS/Deno versucht nicht mehr, sie auszuführen.

## How to apply
Im Projekt-Root:

```bash
unzip -o k1w1-a0style_patch_361_dispatch_template_escape.zip && rm -f k1w1-a0style_patch_361_dispatch_template_escape.zip
supabase functions deploy github-workflow-dispatch
```

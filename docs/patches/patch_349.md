# Patch 349: Fix Supabase function bundling (android-keystore-generate)

## Problem
`supabase functions deploy` failed to bundle **android-keystore-generate** with a parse error:

- `Unexpected eof` near end-of-file

## Root cause
The edge function file `supabase/functions/android-keystore-generate/index.ts` opened a `Deno.serve(async (req) => { ... }` handler but was missing the final closing `});` at EOF, causing an unterminated block and bundler parse failure.

## Fix
- Add the missing closing `});` at the end of the file.

## Notes
This is a syntax-level fix only; no runtime behavior changes beyond allowing the function to bundle and deploy.

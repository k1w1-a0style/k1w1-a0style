# Patch 268: Sanitize GitHub tokens in error strings

**Date:** 2026-02-24

## Problem
`edgeErrorResponseContracts` shows that `errorResponse()` can still return raw GitHub token strings (e.g. `ghp_...`) in the top-level `error` message.
We already redact secrets inside `details`, but the error *string* must be sanitized too.

## Fix
- Broaden `GITHUB_TOKEN_RE` to match common GitHub token formats (`ghp_`, `gho_`, `ghs_`, `ghu_`, `ghr_`, `github_pat_`) starting at length ≥ 10.
- Ensure the error-message sanitizer applies `GITHUB_TOKEN_RE` to all error strings.

## Result
No `ghp_` / `github_pat_` tokens can leak via the `error` field.

# Patch 298

## Summary
Fixes a lint failure in RepoScreen inline diff list caused by a missing React `key` prop on the root element returned from the diff items iterator.

## Changes
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
  - Add `key` to the per-item container (`View`) returned by `map()`.
  - Remove the redundant `key` from the nested `Pressable`.

## Notes
- No runtime behavior changes; UI and diff logic remain unchanged.

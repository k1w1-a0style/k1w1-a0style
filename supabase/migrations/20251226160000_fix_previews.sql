-- Legacy no-op for preview migration history hygiene.
--
-- Context:
-- - `20251226140000_fix_previews.sql` and this migration were committed with
--   byte-identical SQL.
-- - Keeping this timestamped file avoids risky history rewrites for already
--   migrated environments.
-- - Converting it to an explicit no-op avoids duplicate execution in fresh
--   setups and makes intent clear for maintainers.

do $$
begin
  raise notice 'legacy no-op: preview fix already applied by 20251226140000_fix_previews.sql';
end
$$;

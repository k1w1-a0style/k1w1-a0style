
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_build_jobs_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_lint_jobs_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- SECURITY: Auth-Hook liest JWT-Claims pro Aufruf und darf nicht als STABLE gecacht werden.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $$
declare
  claims jsonb;
  app_role text;
begin
  claims := event->'claims';
  app_role := coalesce(event->'claims'->'app_metadata'->>'role', '');

  if app_role = 'build_admin' then
    claims := jsonb_set(claims, '{role}', to_jsonb('build_admin'::text));
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

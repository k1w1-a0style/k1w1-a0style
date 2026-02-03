-- Create audit log for sensitive signing operations (keystore export / generate).
-- Security: RLS enabled; intended for service_role inserts only.

create table if not exists public.signing_audit_log (
  id bigserial primary key,
  repo text not null,
  mode text not null,
  action text not null check (action in ('generate','export','status')),
  actor text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.signing_audit_log enable row level security;

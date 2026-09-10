-- Per-school third-party integration credentials. One row per school.
-- Google Drive: the school pastes its own service account JSON and shares a
-- Drive folder with that service account, so each school's uploads land in
-- its own Drive rather than a single platform-wide account.
create table if not exists public.school_integrations (
  school_id uuid primary key references public.schools(id) on delete cascade,
  google_drive_enabled boolean not null default false,
  google_service_account_key text,
  google_drive_folder_id text,
  google_drive_connected boolean not null default false,
  google_drive_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- google_service_account_key holds a private key. RLS is on with no policies at
-- all, so anon/authenticated clients can neither read nor write this table --
-- every access goes through a service-role API route that checks the caller's
-- role and school first (see /api/admin/drive-settings).
alter table public.school_integrations enable row level security;

create or replace function public.touch_school_integrations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists school_integrations_updated_at on public.school_integrations;
create trigger school_integrations_updated_at
  before update on public.school_integrations
  for each row execute function public.touch_school_integrations_updated_at();

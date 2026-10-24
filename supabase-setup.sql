create table if not exists public.dsm_editors (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.dsm_editors enable row level security;

grant select on public.dsm_editors to authenticated;

drop policy if exists "Editors can read their own membership" on public.dsm_editors;
create policy "Editors can read their own membership"
  on public.dsm_editors
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_dsm_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dsm_editors
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_dsm_editor() from public, anon;
grant execute on function public.is_dsm_editor() to authenticated;

create table if not exists public.dsm_site_state (
  id boolean primary key default true check (id),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.dsm_site_state enable row level security;

grant select on public.dsm_site_state to anon, authenticated;
grant insert, update on public.dsm_site_state to authenticated;

drop policy if exists "Anyone can read the published site" on public.dsm_site_state;
create policy "Anyone can read the published site"
  on public.dsm_site_state
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Editors can create the published site" on public.dsm_site_state;
create policy "Editors can create the published site"
  on public.dsm_site_state
  for insert
  to authenticated
  with check (public.is_dsm_editor());

drop policy if exists "Editors can update the published site" on public.dsm_site_state;
create policy "Editors can update the published site"
  on public.dsm_site_state
  for update
  to authenticated
  using (public.is_dsm_editor())
  with check (public.is_dsm_editor());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dsm_site_state'
  ) then
    execute 'alter publication supabase_realtime add table public.dsm_site_state';
  end if;
end;
$$;

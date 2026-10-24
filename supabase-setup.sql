create table if not exists public.dsm_editors (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.dsm_editors enable row level security;
grant select on public.dsm_editors to authenticated;

drop policy if exists "Editors can read their own membership" on public.dsm_editors;
create policy "Editors can read their own membership"
  on public.dsm_editors for select to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.dsm_site_state (
  id boolean primary key default true check (id),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.dsm_memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  grade text not null default 'Recrue',
  role_id text,
  is_admin boolean not null default false
);

create table if not exists public.dsm_permission_catalog (
  permission text primary key,
  label text not null
);

insert into public.dsm_permission_catalog (permission, label) values
  ('library', 'Créer et modifier les sections, livres et pages'),
  ('lockers', 'Créer et modifier les casiers et notes de recherche'),
  ('quiz', 'Gérer les questionnaires et résultats'),
  ('hierarchy', 'Modifier les grades et les rôles')
on conflict (permission) do update set label = excluded.label;

create table if not exists public.dsm_grade_permissions (
  grade text not null,
  permission text not null references public.dsm_permission_catalog (permission),
  allowed boolean not null default true,
  primary key (grade, permission)
);

create table if not exists public.dsm_role_permissions (
  role_id text not null,
  permission text not null references public.dsm_permission_catalog (permission),
  allowed boolean not null default true,
  primary key (role_id, permission)
);

create table if not exists public.dsm_member_overrides (
  user_id uuid not null references public.dsm_memberships (user_id) on delete cascade,
  permission text not null references public.dsm_permission_catalog (permission),
  allowed boolean not null,
  primary key (user_id, permission)
);

create table if not exists public.dsm_registration_link (
  id boolean primary key default true check (id),
  token_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.dsm_memberships enable row level security;
alter table public.dsm_permission_catalog enable row level security;
alter table public.dsm_grade_permissions enable row level security;
alter table public.dsm_role_permissions enable row level security;
alter table public.dsm_member_overrides enable row level security;
alter table public.dsm_registration_link enable row level security;
revoke all on public.dsm_memberships, public.dsm_permission_catalog,
  public.dsm_grade_permissions, public.dsm_role_permissions,
  public.dsm_member_overrides, public.dsm_registration_link
  from public, anon, authenticated;
grant all on public.dsm_memberships, public.dsm_permission_catalog,
  public.dsm_grade_permissions, public.dsm_role_permissions,
  public.dsm_member_overrides, public.dsm_registration_link to service_role;

insert into public.dsm_memberships (user_id)
select user_id from public.dsm_editors
on conflict (user_id) do nothing;

create or replace function public.is_dsm_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dsm_memberships
    where user_id = (select auth.uid()) and is_admin
  );
$$;

create or replace function public.dsm_has_permission(p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if public.is_dsm_admin() then
    return true;
  end if;

  select coalesce(
    o.allowed,
    coalesce(g.allowed, false) or coalesce(r.allowed, false),
    false
  )
  into v_allowed
  from public.dsm_memberships m
  left join public.dsm_grade_permissions g
    on g.grade = m.grade and g.permission = p_permission
    and exists (
      select 1 from public.dsm_site_state s,
        jsonb_array_elements_text(s.data->'lvs') as grade_item(value)
      where grade_item.value = m.grade
    )
  left join public.dsm_role_permissions r
    on r.role_id = m.role_id and r.permission = p_permission
    and exists (
      select 1 from public.dsm_site_state s,
        jsonb_array_elements(s.data->'roles') as role_item(value)
      where role_item.value->>'id' = m.role_id
    )
  left join public.dsm_member_overrides o
    on o.user_id = m.user_id and o.permission = p_permission
  where m.user_id = (select auth.uid())
    and exists (
      select 1 from public.dsm_permission_catalog
      where permission = p_permission
    );

  return coalesce(v_allowed, false);
end;
$$;

create or replace function public.is_dsm_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_dsm_admin()
    or exists (
      select 1 from public.dsm_permission_catalog
      where public.dsm_has_permission(permission)
    );
$$;

create or replace function public.dsm_my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'is_admin', public.is_dsm_admin(),
    'grade', (select grade from public.dsm_memberships where user_id = (select auth.uid())),
    'role_id', (select role_id from public.dsm_memberships where user_id = (select auth.uid())),
    'permissions', coalesce((
      select jsonb_object_agg(permission, public.dsm_has_permission(permission))
      from public.dsm_permission_catalog
    ), '{}'::jsonb)
  );
$$;

create or replace function public.dsm_admin_list_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_dsm_admin() then
    raise exception 'Accès réservé à l’administrateur.';
  end if;

  return jsonb_build_object(
    'grades', coalesce((
      select jsonb_agg(jsonb_build_object('grade', grade, 'permission', permission))
      from public.dsm_grade_permissions where allowed
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('role_id', role_id, 'permission', permission))
      from public.dsm_role_permissions where allowed
    ), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'permission', permission, 'allowed', allowed
      ))
      from public.dsm_member_overrides
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', u.id,
        'email', u.email,
        'grade', coalesce(m.grade, 'Recrue'),
        'role_id', m.role_id,
        'is_admin', coalesce(m.is_admin, false),
        'is_member', m.user_id is not null
      ) order by lower(u.email))
      from auth.users u
      left join public.dsm_memberships m on m.user_id = u.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.dsm_admin_set_permission(
  p_scope text,
  p_subject text,
  p_permission text,
  p_allowed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_dsm_admin() then
    raise exception 'Accès réservé à l’administrateur.';
  end if;
  if p_scope is null or p_scope not in ('grade', 'role')
      or nullif(trim(p_subject), '') is null then
    raise exception 'Le grade ou rôle indiqué est invalide.';
  end if;
  if not exists (
    select 1 from public.dsm_permission_catalog where permission = p_permission
  ) then
    raise exception 'Cette permission est inconnue.';
  end if;

  if p_scope = 'grade' then
    if not exists (
      select 1 from public.dsm_site_state s,
        jsonb_array_elements_text(s.data->'lvs') as grade(value)
      where grade.value = p_subject
    ) then
      raise exception 'Ce grade n’existe pas dans la hiérarchie du site.';
    end if;
    if p_allowed then
      insert into public.dsm_grade_permissions (grade, permission, allowed)
      values (p_subject, p_permission, true)
      on conflict (grade, permission) do update set allowed = true;
    else
      delete from public.dsm_grade_permissions
      where grade = p_subject and permission = p_permission;
    end if;
  else
    if not exists (
      select 1 from public.dsm_site_state s,
        jsonb_array_elements(s.data->'roles') as role_item(value)
      where role_item.value->>'id' = p_subject
    ) then
      raise exception 'Ce rôle n’existe pas dans la hiérarchie du site.';
    end if;
    if p_allowed then
      insert into public.dsm_role_permissions (role_id, permission, allowed)
      values (p_subject, p_permission, true)
      on conflict (role_id, permission) do update set allowed = true;
    else
      delete from public.dsm_role_permissions
      where role_id = p_subject and permission = p_permission;
    end if;
  end if;
end;
$$;

create or replace function public.dsm_admin_set_member_access(
  p_user_id uuid,
  p_grade text,
  p_role_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_dsm_admin() then
    raise exception 'Accès réservé à l’administrateur.';
  end if;
  if p_grade is null or not exists (
    select 1 from public.dsm_site_state s,
      jsonb_array_elements_text(s.data->'lvs') as grade(value)
    where grade.value = p_grade
  ) then
    raise exception 'Ce grade n’existe pas dans la hiérarchie du site.';
  end if;
  if p_role_id is not null and not exists (
    select 1 from public.dsm_site_state s,
      jsonb_array_elements(s.data->'roles') as role_item(value)
    where role_item.value->>'id' = p_role_id
  ) then
    raise exception 'Ce rôle n’existe pas dans la hiérarchie du site.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Ce compte Supabase est introuvable.';
  end if;

  insert into public.dsm_memberships as current_member (user_id, grade, role_id)
  values (p_user_id, p_grade, p_role_id)
  on conflict (user_id) do update
    set grade = excluded.grade, role_id = excluded.role_id
    where not current_member.is_admin;
end;
$$;

create or replace function public.dsm_admin_set_member_override(
  p_user_id uuid,
  p_permission text,
  p_allowed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_dsm_admin() then
    raise exception 'Accès réservé à l’administrateur.';
  end if;
  if not exists (
    select 1 from public.dsm_permission_catalog where permission = p_permission
  ) then
    raise exception 'Cette permission est inconnue.';
  end if;
  if not exists (
    select 1 from public.dsm_memberships
    where user_id = p_user_id and not is_admin
  ) then
    raise exception 'Ce compte ne peut pas recevoir de dérogation.';
  end if;

  if p_allowed is null then
    delete from public.dsm_member_overrides
    where user_id = p_user_id and permission = p_permission;
  else
    insert into public.dsm_member_overrides (user_id, permission, allowed)
    values (p_user_id, p_permission, p_allowed)
    on conflict (user_id, permission) do update set allowed = excluded.allowed;
  end if;
end;
$$;

revoke all on function public.is_dsm_admin() from public, anon;
revoke all on function public.dsm_has_permission(text) from public, anon;
revoke all on function public.is_dsm_editor() from public, anon;
revoke all on function public.dsm_my_access() from public, anon;
revoke all on function public.dsm_admin_list_permissions() from public, anon;
revoke all on function public.dsm_admin_set_permission(text, text, text, boolean) from public, anon;
revoke all on function public.dsm_admin_set_member_access(uuid, text, text) from public, anon;
revoke all on function public.dsm_admin_set_member_override(uuid, text, boolean) from public, anon;
grant execute on function public.is_dsm_admin() to authenticated;
grant execute on function public.dsm_has_permission(text) to authenticated;
grant execute on function public.is_dsm_editor() to authenticated;
grant execute on function public.dsm_my_access() to authenticated;
grant execute on function public.dsm_admin_list_permissions() to authenticated;
grant execute on function public.dsm_admin_set_permission(text, text, text, boolean) to authenticated;
grant execute on function public.dsm_admin_set_member_access(uuid, text, text) to authenticated;
grant execute on function public.dsm_admin_set_member_override(uuid, text, boolean) to authenticated;

create or replace function public.dsm_enforce_site_state_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_dsm_admin() then
      raise exception 'Seul l’administrateur peut initialiser le contenu partagé.';
    end if;
    return new;
  end if;

  if (new.data - array['secs', 'books', 'cas', 'att', 'qs', 'roles', 'lvs'])
      is distinct from
     (old.data - array['secs', 'books', 'cas', 'att', 'qs', 'roles', 'lvs']) then
    raise exception 'Le contenu contient des champs non autorisés.';
  end if;
  if (new.data->'secs') is distinct from (old.data->'secs')
      or (new.data->'books') is distinct from (old.data->'books') then
    if not public.dsm_has_permission('library') then
      raise exception 'Permission refusée : bibliothèque.';
    end if;
  end if;
  if (new.data->'cas') is distinct from (old.data->'cas') then
    if not public.dsm_has_permission('lockers') then
      raise exception 'Permission refusée : casiers de recherche.';
    end if;
  end if;
  if (new.data->'att') is distinct from (old.data->'att')
      or (new.data->'qs') is distinct from (old.data->'qs') then
    if not public.dsm_has_permission('quiz') then
      raise exception 'Permission refusée : questionnaires et résultats.';
    end if;
  end if;
  if (new.data->'roles') is distinct from (old.data->'roles')
      or (new.data->'lvs') is distinct from (old.data->'lvs') then
    if not public.dsm_has_permission('hierarchy') then
      raise exception 'Permission refusée : grades et rôles.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists dsm_site_state_permissions on public.dsm_site_state;
create trigger dsm_site_state_permissions
  before insert or update on public.dsm_site_state
  for each row execute function public.dsm_enforce_site_state_permissions();

alter table public.dsm_site_state enable row level security;
grant select on public.dsm_site_state to anon, authenticated;
grant insert, update on public.dsm_site_state to authenticated;

drop policy if exists "Anyone can read the published site" on public.dsm_site_state;
create policy "Anyone can read the published site"
  on public.dsm_site_state for select to anon, authenticated
  using (true);

drop policy if exists "Editors can create the published site" on public.dsm_site_state;
create policy "Editors can create the published site"
  on public.dsm_site_state for insert to authenticated
  with check (public.is_dsm_admin());

drop policy if exists "Editors can update the published site" on public.dsm_site_state;
create policy "Editors can update the published site"
  on public.dsm_site_state for update to authenticated
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

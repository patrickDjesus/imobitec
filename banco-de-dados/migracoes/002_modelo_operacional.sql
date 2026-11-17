-- Imobitec | Modelo operacional para uma única imobiliária
-- Pré-requisito: executar 001_autenticacao_inicial.sql primeiro.
-- Execute este arquivo no Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'Imobitec Imobiliária', 'imobitec')
on conflict (slug) do update set name = excluded.name;

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations(id);

update public.profiles
set organization_id = '00000000-0000-4000-8000-000000000001'
where organization_id is null;

alter table public.profiles
  alter column organization_id set not null;

-- Usuário informado como administrador do projeto.
update public.profiles
set role = 'admin', is_active = true, updated_at = now()
where id = '98ed30c7-60cc-449e-ae1a-45e56f9b00ca';

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '98ed30c7-60cc-449e-ae1a-45e56f9b00ca'
  ) then
    raise exception 'Perfil do administrador não encontrado. Verifique UUID e execução do arquivo 001.';
  end if;
end;
$$;

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.profiles
  where id = (select auth.uid()) and is_active = true
$$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid()) and is_active = true
$$;

create or replace function private.can_manage()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() in ('admin', 'manager'), false)
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'admin', false)
$$;

revoke all on schema private from public;
revoke execute on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.current_organization_id() to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.can_manage() to authenticated;
grant execute on function private.is_admin() to authenticated;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete restrict,
  reference_code text not null,
  name text not null,
  property_type text not null
    check (property_type in ('apartment', 'house', 'studio', 'commercial', 'other')),
  status text not null default 'available'
    check (status in ('available', 'occupied', 'maintenance', 'inactive')),
  tenant_name text,
  address_line text not null,
  address_number text,
  district text,
  city text not null,
  state char(2) not null,
  postal_code text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference_code)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  room_type text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, name)
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  inspection_type text not null
    check (inspection_type in ('entry', 'periodic', 'exit')),
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  inspector_id uuid not null default auth.uid() references auth.users(id),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  quality_score smallint check (quality_score between 0 and 100),
  general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  item_name text not null,
  category text not null,
  condition text not null
    check (condition in ('compliant', 'attention', 'non_compliant')),
  severity text
    check (severity in ('low', 'medium', 'high', 'critical')),
  weight numeric(5,2) not null default 1 check (weight > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nonconformities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  inspection_item_id uuid references public.inspection_items(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete restrict,
  title text not null,
  description text,
  severity text not null
    check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'awaiting_validation', 'validated', 'cancelled')),
  assigned_to uuid references auth.users(id),
  due_date date,
  resolved_at timestamptz,
  validated_at timestamptz,
  validated_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  nonconformity_id uuid not null references public.nonconformities(id) on delete cascade,
  description text not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'rejected')),
  responsible_id uuid references auth.users(id),
  due_date date,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  inspection_id uuid references public.inspections(id) on delete cascade,
  inspection_item_id uuid references public.inspection_items(id) on delete cascade,
  nonconformity_id uuid references public.nonconformities(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint check (file_size is null or file_size >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (
    inspection_id is not null
    or inspection_item_id is not null
    or nonconformity_id is not null
  )
);

create index if not exists profiles_organization_idx on public.profiles(organization_id);
create index if not exists properties_organization_idx on public.properties(organization_id);
create index if not exists rooms_organization_idx on public.rooms(organization_id);
create index if not exists rooms_property_idx on public.rooms(property_id);
create index if not exists inspections_organization_idx on public.inspections(organization_id);
create index if not exists inspections_property_idx on public.inspections(property_id);
create index if not exists inspections_inspector_idx on public.inspections(inspector_id);
create index if not exists inspection_items_organization_idx on public.inspection_items(organization_id);
create index if not exists inspection_items_inspection_idx on public.inspection_items(inspection_id);
create index if not exists nonconformities_organization_idx on public.nonconformities(organization_id);
create index if not exists nonconformities_property_idx on public.nonconformities(property_id);
create index if not exists corrective_actions_organization_idx on public.corrective_actions(organization_id);
create index if not exists evidence_files_organization_idx on public.evidence_files(organization_id);

-- Novos usuários entram na imobiliária única como inspetores.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, organization_id)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'inspector',
    '00000000-0000-4000-8000-000000000001'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Atualização automática de updated_at.
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute procedure public.set_updated_at();
drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties
for each row execute procedure public.set_updated_at();
drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at before update on public.rooms
for each row execute procedure public.set_updated_at();
drop trigger if exists inspections_set_updated_at on public.inspections;
create trigger inspections_set_updated_at before update on public.inspections
for each row execute procedure public.set_updated_at();
drop trigger if exists inspection_items_set_updated_at on public.inspection_items;
create trigger inspection_items_set_updated_at before update on public.inspection_items
for each row execute procedure public.set_updated_at();
drop trigger if exists nonconformities_set_updated_at on public.nonconformities;
create trigger nonconformities_set_updated_at before update on public.nonconformities
for each row execute procedure public.set_updated_at();
drop trigger if exists corrective_actions_set_updated_at on public.corrective_actions;
create trigger corrective_actions_set_updated_at before update on public.corrective_actions
for each row execute procedure public.set_updated_at();

-- Bloqueio anônimo e privilégios mínimos para usuários autenticados.
revoke all on public.organizations, public.profiles, public.properties, public.rooms,
  public.inspections, public.inspection_items, public.nonconformities,
  public.corrective_actions, public.evidence_files from anon;

revoke all on public.organizations, public.profiles, public.properties, public.rooms,
  public.inspections, public.inspection_items, public.nonconformities,
  public.corrective_actions, public.evidence_files from authenticated;

grant select on public.organizations, public.profiles, public.properties, public.rooms,
  public.inspections, public.inspection_items, public.nonconformities,
  public.corrective_actions, public.evidence_files to authenticated;
grant insert, update, delete on public.properties, public.rooms, public.inspections,
  public.inspection_items, public.nonconformities, public.corrective_actions,
  public.evidence_files to authenticated;
grant update (full_name) on public.profiles to authenticated;

alter table public.organizations enable row level security;
alter table public.properties enable row level security;
alter table public.rooms enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;
alter table public.nonconformities enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.evidence_files enable row level security;

-- Perfis: membros veem equipe; usuário altera somente próprio nome.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_organization" on public.profiles;
create policy "profiles_select_organization" on public.profiles
for select to authenticated
using (organization_id = (select private.current_organization_id()));
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and organization_id = (select private.current_organization_id())
);

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member" on public.organizations
for select to authenticated
using (id = (select private.current_organization_id()));

-- Tabelas cadastrais: equipe lê; administrador/gestor escreve; admin exclui.
drop policy if exists "properties_select_member" on public.properties;
create policy "properties_select_member" on public.properties for select to authenticated
using (organization_id = (select private.current_organization_id()));
drop policy if exists "properties_insert_manager" on public.properties;
create policy "properties_insert_manager" on public.properties for insert to authenticated
with check (organization_id = (select private.current_organization_id()) and (select private.can_manage()));
drop policy if exists "properties_update_manager" on public.properties;
create policy "properties_update_manager" on public.properties for update to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.can_manage()))
with check (organization_id = (select private.current_organization_id()) and (select private.can_manage()));
drop policy if exists "properties_delete_admin" on public.properties;
create policy "properties_delete_admin" on public.properties for delete to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.is_admin()));

drop policy if exists "rooms_select_member" on public.rooms;
create policy "rooms_select_member" on public.rooms for select to authenticated
using (organization_id = (select private.current_organization_id()));
drop policy if exists "rooms_insert_manager" on public.rooms;
create policy "rooms_insert_manager" on public.rooms for insert to authenticated
with check (organization_id = (select private.current_organization_id()) and (select private.can_manage()));
drop policy if exists "rooms_update_manager" on public.rooms;
create policy "rooms_update_manager" on public.rooms for update to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.can_manage()))
with check (organization_id = (select private.current_organization_id()) and (select private.can_manage()));
drop policy if exists "rooms_delete_admin" on public.rooms;
create policy "rooms_delete_admin" on public.rooms for delete to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.is_admin()));

-- Operação: qualquer membro ativo trabalha; exclusão somente admin.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'inspections', 'inspection_items', 'nonconformities',
    'corrective_actions', 'evidence_files'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_member', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = (select private.current_organization_id()))',
      table_name || '_select_member', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_member', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = (select private.current_organization_id()))',
      table_name || '_insert_member', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_update_member', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = (select private.current_organization_id())) with check (organization_id = (select private.current_organization_id()))',
      table_name || '_update_member', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_admin', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = (select private.current_organization_id()) and (select private.is_admin()))',
      table_name || '_delete_admin', table_name
    );
  end loop;
end;
$$;

-- Administração de papel sem permitir autoelevação pelo frontend.
create or replace function public.admin_set_profile_access(
  target_user_id uuid,
  new_role text,
  new_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem alterar acessos';
  end if;
  if new_role not in ('admin', 'manager', 'inspector') then
    raise exception 'Papel inválido';
  end if;
  update public.profiles
  set role = new_role, is_active = new_is_active, updated_at = now()
  where id = target_user_id
    and organization_id = private.current_organization_id();
end;
$$;

revoke all on function public.admin_set_profile_access(uuid, text, boolean) from public;
grant execute on function public.admin_set_profile_access(uuid, text, boolean) to authenticated;

commit;

-- Conferência final:
-- select p.id, p.full_name, p.role, p.is_active, o.name as organization
-- from public.profiles p
-- join public.organizations o on o.id = p.organization_id
-- where p.id = '98ed30c7-60cc-449e-ae1a-45e56f9b00ca';

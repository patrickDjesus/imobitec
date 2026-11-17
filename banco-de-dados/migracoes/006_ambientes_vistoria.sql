-- Imobitec | Ambientes vinculados às vistorias
-- Pré-requisito: executar 001 a 005 em ordem.
-- Execute este arquivo no Supabase SQL Editor.

begin;

alter table public.inspections
  add column if not exists room_count integer not null default 0;

alter table public.inspections
  drop constraint if exists inspections_room_count_check;
alter table public.inspections
  add constraint inspections_room_count_check
  check (room_count between 0 and 99999);

create table if not exists public.inspection_environments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  environment_type text not null check (environment_type in (
    'living_room', 'dining_room', 'kitchen', 'bedroom', 'bathroom',
    'garage', 'laundry', 'office', 'balcony', 'hallway', 'pantry',
    'closet', 'pool', 'outdoor_area', 'other'
  )),
  name text not null check (char_length(trim(name)) between 1 and 120),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (inspection_id, name)
);

create unique index if not exists inspection_environments_name_ci_key
  on public.inspection_environments (inspection_id, lower(trim(name)));
create index if not exists inspection_environments_inspection_idx
  on public.inspection_environments (inspection_id, sort_order);
create index if not exists inspection_environments_organization_idx
  on public.inspection_environments (organization_id);

-- Protege limite total escolhido para a vistoria.
create or replace function public.validate_inspection_room_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  property_room_count integer;
  registered_environments integer;
begin
  select room_count
    into property_room_count
  from public.properties
  where id = new.property_id
    and organization_id = new.organization_id;

  if not found then
    raise exception 'Imóvel não encontrado na organização atual';
  end if;

  if new.room_count > property_room_count then
    raise exception 'Cômodos da vistoria (%) excedem limite do imóvel (%)', new.room_count, property_room_count;
  end if;

  if tg_op = 'UPDATE' then
    select count(*) into registered_environments
    from public.inspection_environments
    where inspection_id = new.id;

    if new.room_count < registered_environments then
      raise exception 'Remova ambientes antes de diminuir cômodos da vistoria';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inspections_validate_room_count on public.inspections;
create trigger inspections_validate_room_count
before insert or update of property_id, organization_id, room_count on public.inspections
for each row execute procedure public.validate_inspection_room_count();

-- Protege total e limites específicos de quartos, banheiros, garagens e piscinas.
create or replace function public.validate_inspection_environment_limits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inspection_record record;
  property_record record;
  total_registered integer;
  type_registered integer;
  type_limit integer;
begin
  select id, property_id, organization_id, room_count
    into inspection_record
  from public.inspections
  where id = new.inspection_id;

  if not found then
    raise exception 'Vistoria não encontrada';
  end if;

  if new.organization_id <> inspection_record.organization_id then
    raise exception 'Ambiente e vistoria precisam pertencer à mesma organização';
  end if;

  select bedroom_count, bathroom_count, garage_space_count, pool_count
    into property_record
  from public.properties
  where id = inspection_record.property_id
    and organization_id = inspection_record.organization_id;

  select count(*) into total_registered
  from public.inspection_environments
  where inspection_id = new.inspection_id
    and id <> new.id;

  if total_registered + 1 > inspection_record.room_count then
    raise exception 'Quantidade de ambientes excede cômodos definidos para vistoria (%)', inspection_record.room_count;
  end if;

  type_limit := case new.environment_type
    when 'bedroom' then property_record.bedroom_count
    when 'bathroom' then property_record.bathroom_count
    when 'garage' then property_record.garage_space_count
    when 'pool' then property_record.pool_count
    else null
  end;

  if type_limit is not null then
    select count(*) into type_registered
    from public.inspection_environments
    where inspection_id = new.inspection_id
      and environment_type = new.environment_type
      and id <> new.id;

    if type_registered + 1 > type_limit then
      raise exception 'Quantidade do tipo % excede limite cadastrado no imóvel (%)', new.environment_type, type_limit;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inspection_environments_validate_limits on public.inspection_environments;
create trigger inspection_environments_validate_limits
before insert or update of inspection_id, organization_id, environment_type
on public.inspection_environments
for each row execute procedure public.validate_inspection_environment_limits();

alter table public.inspection_environments enable row level security;

drop policy if exists "inspection_environments_select_member" on public.inspection_environments;
create policy "inspection_environments_select_member" on public.inspection_environments
for select to authenticated
using (organization_id = (select private.current_organization_id()));

drop policy if exists "inspection_environments_insert_member" on public.inspection_environments;
create policy "inspection_environments_insert_member" on public.inspection_environments
for insert to authenticated
with check (organization_id = (select private.current_organization_id()));

drop policy if exists "inspection_environments_update_member" on public.inspection_environments;
create policy "inspection_environments_update_member" on public.inspection_environments
for update to authenticated
using (organization_id = (select private.current_organization_id()))
with check (organization_id = (select private.current_organization_id()));

drop policy if exists "inspection_environments_delete_admin" on public.inspection_environments;
create policy "inspection_environments_delete_admin" on public.inspection_environments
for delete to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.is_admin()));

revoke all on public.inspection_environments from anon;
revoke all on public.inspection_environments from authenticated;
grant select, insert, update, delete on public.inspection_environments to authenticated;

-- Salva vistoria e ambientes na mesma transação.
create or replace function public.create_inspection_with_environments(
  p_property_id uuid,
  p_inspection_type text,
  p_scheduled_at timestamptz,
  p_inspector_id uuid,
  p_status text,
  p_room_count integer,
  p_environments jsonb
)
returns public.inspections
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_inspection public.inspections;
  environment jsonb;
  environment_position integer;
  environment_count integer;
  property_organization_id uuid;
begin
  if jsonb_typeof(p_environments) <> 'array' then
    raise exception 'Ambientes precisam ser enviados como lista';
  end if;

  environment_count := jsonb_array_length(p_environments);
  if p_room_count < 1 then
    raise exception 'Informe pelo menos um cômodo para vistoriar';
  end if;
  if environment_count <> p_room_count then
    raise exception 'Quantidade de ambientes (%) precisa corresponder aos cômodos da vistoria (%)', environment_count, p_room_count;
  end if;

  select organization_id into property_organization_id
  from public.properties
  where id = p_property_id;

  if not found then
    raise exception 'Imóvel não encontrado ou sem permissão de acesso';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_inspector_id
      and organization_id = property_organization_id
      and is_active = true
  ) then
    raise exception 'Responsável inválido ou inativo';
  end if;

  insert into public.inspections (
    organization_id, property_id, inspection_type, scheduled_at,
    inspector_id, status, room_count
  ) values (
    property_organization_id, p_property_id, p_inspection_type, p_scheduled_at,
    p_inspector_id, p_status, p_room_count
  )
  returning * into new_inspection;

  for environment, environment_position in
    select value, ordinality::integer - 1
    from jsonb_array_elements(p_environments) with ordinality
  loop
    insert into public.inspection_environments (
      organization_id, inspection_id, environment_type, name, sort_order
    ) values (
      property_organization_id,
      new_inspection.id,
      environment ->> 'type',
      trim(environment ->> 'name'),
      environment_position
    );
  end loop;

  return new_inspection;
end;
$$;

revoke all on function public.create_inspection_with_environments(uuid, text, timestamptz, uuid, text, integer, jsonb) from public;
grant execute on function public.create_inspection_with_environments(uuid, text, timestamptz, uuid, text, integer, jsonb) to authenticated;

comment on table public.inspection_environments is
  'Snapshot dos ambientes selecionados para cada vistoria.';
comment on column public.inspections.room_count is
  'Quantidade de ambientes definida para vistoria, limitada pelo cadastro do imóvel.';

commit;

-- Validação opcional:
-- select i.inspection_number, i.room_count, e.environment_type, e.name
-- from public.inspections i
-- join public.inspection_environments e on e.inspection_id = i.id
-- order by i.inspection_number desc, e.sort_order;

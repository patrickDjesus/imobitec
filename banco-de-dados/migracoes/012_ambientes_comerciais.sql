-- Imobitec | Tipos de ambiente para imóveis comerciais
-- Pré-requisito: executar 001 a 011 em ordem.
-- Execute este arquivo no Supabase SQL Editor.

begin;

alter table public.inspection_environments
  drop constraint if exists inspection_environments_environment_type_check;
alter table public.inspection_environments
  add constraint inspection_environments_environment_type_check
  check (environment_type in (
    'living_room', 'dining_room', 'kitchen', 'bedroom', 'bathroom',
    'garage', 'laundry', 'office', 'balcony', 'hallway', 'pantry',
    'closet', 'pool', 'outdoor_area', 'other',
    'reception', 'service_area', 'sales_area', 'meeting_room', 'warehouse',
    'commercial_kitchen', 'locker_room', 'loading_area', 'technical_room',
    'server_room', 'production_area'
  ));

alter table public.inspection_checklist_templates
  drop constraint if exists inspection_checklist_templates_environment_type_check;
alter table public.inspection_checklist_templates
  add constraint inspection_checklist_templates_environment_type_check
  check (environment_type in (
    'living_room', 'dining_room', 'kitchen', 'bedroom', 'bathroom',
    'garage', 'laundry', 'office', 'balcony', 'hallway', 'pantry',
    'closet', 'pool', 'outdoor_area', 'other',
    'reception', 'service_area', 'sales_area', 'meeting_room', 'warehouse',
    'commercial_kitchen', 'locker_room', 'loading_area', 'technical_room',
    'server_room', 'production_area'
  ));

-- Além do domínio geral, valida a lista correspondente ao enquadramento do imóvel.
create or replace function public.validate_inspection_environment_limits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inspection_record record;
  total_registered integer;
begin
  select i.id, i.organization_id, i.room_count, p.classification
    into inspection_record
  from public.inspections i
  join public.properties p
    on p.id = i.property_id
   and p.organization_id = i.organization_id
  where i.id = new.inspection_id;

  if not found then
    raise exception 'Vistoria ou imóvel vinculado não encontrado';
  end if;

  if new.organization_id <> inspection_record.organization_id then
    raise exception 'Ambiente e vistoria precisam pertencer à mesma organização';
  end if;

  if inspection_record.classification = 'commercial'
     and not new.environment_type = any (array[
       'reception', 'service_area', 'sales_area', 'office', 'meeting_room',
       'warehouse', 'pantry', 'commercial_kitchen', 'bathroom', 'locker_room',
       'hallway', 'garage', 'loading_area', 'technical_room', 'server_room',
       'production_area', 'outdoor_area', 'other'
     ]) then
    raise exception 'Tipo de ambiente (%) não permitido para imóvel comercial', new.environment_type;
  end if;

  if inspection_record.classification = 'residential'
     and not new.environment_type = any (array[
       'living_room', 'dining_room', 'kitchen', 'bedroom', 'bathroom',
       'garage', 'laundry', 'office', 'balcony', 'hallway', 'pantry',
       'closet', 'pool', 'outdoor_area', 'other'
     ]) then
    raise exception 'Tipo de ambiente (%) não permitido para imóvel residencial', new.environment_type;
  end if;

  select count(*) into total_registered
  from public.inspection_environments
  where inspection_id = new.inspection_id
    and id <> new.id;

  if total_registered + 1 > inspection_record.room_count then
    raise exception 'Quantidade de ambientes excede cômodos definidos para vistoria (%)', inspection_record.room_count;
  end if;

  return new;
end;
$$;

comment on column public.inspection_environments.environment_type is
  'Tipo fixo de ambiente residencial ou comercial selecionado para a vistoria.';
comment on column public.inspection_checklist_templates.environment_type is
  'Tipo de ambiente residencial ou comercial ao qual o modelo de checklist se aplica.';

commit;

-- Validação opcional:
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid in (
--   'public.inspection_environments'::regclass,
--   'public.inspection_checklist_templates'::regclass
-- ) and contype = 'c';

-- Execute após 006_ambientes_vistoria.sql.
-- Simplifica o imóvel: ambientes específicos passam a ser definidos na vistoria.

begin;

-- Mantém somente o limite total de ambientes definido para a vistoria.
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
  select id, organization_id, room_count
    into inspection_record
  from public.inspections
  where id = new.inspection_id;

  if not found then
    raise exception 'Vistoria não encontrada';
  end if;

  if new.organization_id <> inspection_record.organization_id then
    raise exception 'Ambiente e vistoria precisam pertencer à mesma organização';
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

alter table public.properties
  drop constraint if exists properties_counts_check;

alter table public.properties
  drop column if exists bedroom_count,
  drop column if exists bathroom_count,
  drop column if exists garage_space_count,
  drop column if exists pool_count;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.properties'::regclass
      and conname = 'properties_room_count_check'
  ) then
    alter table public.properties
      add constraint properties_room_count_check
      check (room_count between 0 and 99999);
  end if;
end;
$$;

comment on column public.properties.room_count is
  'Quantidade total máxima de ambientes que poderá ser discriminada em cada vistoria.';

commit;

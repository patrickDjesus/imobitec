-- Imobitec | Cadastro inicial de vistorias
-- Pré-requisito: executar 001, 002, 003 e 004 em ordem.
-- Execute este arquivo no Supabase SQL Editor.

begin;

alter table public.inspections
  add column if not exists inspection_number bigint generated always as identity;

-- Registros antigos recebem data válida antes da obrigatoriedade.
update public.inspections
set scheduled_at = coalesce(scheduled_at, created_at, now())
where scheduled_at is null;

alter table public.inspections
  alter column scheduled_at set not null,
  drop constraint if exists inspections_inspection_type_check;

alter table public.inspections
  add constraint inspections_inspection_type_check
  check (inspection_type in ('entry', 'exit', 'periodic', 'maintenance'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inspections_inspection_number_key') then
    alter table public.inspections
      add constraint inspections_inspection_number_key unique (inspection_number);
  end if;
end;
$$;

create index if not exists inspections_schedule_idx
  on public.inspections (organization_id, scheduled_at desc);
create index if not exists inspections_status_idx
  on public.inspections (organization_id, status);

grant select, insert, update, delete on public.inspections to authenticated;
grant usage, select on sequence public.inspections_inspection_number_seq to authenticated;

comment on column public.inspections.id is
  'UUID interno usado nos relacionamentos do sistema.';
comment on column public.inspections.inspection_number is
  'ID numérico sequencial exibido ao usuário.';
comment on column public.inspections.property_id is
  'Imóvel vinculado por chave estrangeira.';
comment on column public.inspections.scheduled_at is
  'Data e horário informados para realização da vistoria.';
comment on column public.inspections.inspector_id is
  'Usuário responsável pela vistoria.';

commit;

-- Validação opcional:
-- select inspection_number, property_id, inspection_type, scheduled_at, inspector_id, status
-- from public.inspections order by inspection_number desc;

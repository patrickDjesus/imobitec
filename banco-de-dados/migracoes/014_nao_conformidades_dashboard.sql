-- Imobitec | Não conformidades automáticas e fluxo seguro de correção
-- Pré-requisito: executar 001 a 013 em ordem.
-- Execute este arquivo no Supabase SQL Editor.

begin;

alter table public.nonconformities
  add column if not exists source_condition text;

update public.nonconformities
set source_condition = 'non_compliant'
where source_condition is null;

alter table public.nonconformities
  alter column source_condition set default 'non_compliant',
  alter column source_condition set not null;

alter table public.nonconformities
  drop constraint if exists nonconformities_source_condition_check;
alter table public.nonconformities
  add constraint nonconformities_source_condition_check
  check (source_condition in ('attention', 'non_compliant'));

create index if not exists nonconformities_status_idx
  on public.nonconformities (organization_id, status, created_at desc);
create index if not exists nonconformities_inspection_item_idx
  on public.nonconformities (inspection_item_id)
  where inspection_item_id is not null;

-- Grava resultados, sincroniza pendências, calcula qualidade e conclui na mesma transação.
create or replace function public.complete_inspection(
  p_inspection_id uuid,
  p_general_notes text,
  p_items jsonb
)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_organization uuid;
  inspection_record record;
  database_item_count integer;
  payload_item_count integer;
  updated_item_count integer;
  calculated_score smallint;
  completed_inspection public.inspections;
begin
  current_organization := private.current_organization_id();
  if current_organization is null then
    raise exception 'Usuário sem organização ativa';
  end if;

  select id, property_id, inspector_id
    into inspection_record
  from public.inspections
  where id = p_inspection_id
    and organization_id = current_organization
  for update;

  if not found then
    raise exception 'Vistoria não encontrada ou sem permissão de acesso';
  end if;

  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Resultados precisam ser enviados como lista';
  end if;

  select count(*) into database_item_count
  from public.inspection_items
  where inspection_id = p_inspection_id
    and organization_id = current_organization;

  payload_item_count := jsonb_array_length(p_items);
  if database_item_count < 1 then
    raise exception 'Vistoria não possui itens de checklist';
  end if;
  if payload_item_count <> database_item_count then
    raise exception 'Todos os itens da vistoria precisam receber resultado';
  end if;
  if (
    select count(distinct item ->> 'id')
    from jsonb_array_elements(p_items) item
  ) <> payload_item_count then
    raise exception 'Lista contém itens duplicados';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(item ->> 'condition', '') not in ('compliant', 'attention', 'non_compliant', 'not_applicable')
  ) then
    raise exception 'Resultado inválido no checklist';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where item ->> 'condition' in ('attention', 'non_compliant')
      and nullif(trim(coalesce(item ->> 'notes', '')), '') is null
  ) then
    raise exception 'Itens de Atenção ou Não conforme precisam de observação';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where not exists (
      select 1 from public.inspection_items database_item
      where database_item.id = (item ->> 'id')::uuid
        and database_item.inspection_id = p_inspection_id
        and database_item.organization_id = current_organization
    )
  ) then
    raise exception 'Item não pertence a esta vistoria';
  end if;

  update public.inspection_items database_item
  set condition = item ->> 'condition',
      notes = nullif(trim(item ->> 'notes'), '')
  from jsonb_array_elements(p_items) item
  where database_item.id = (item ->> 'id')::uuid
    and database_item.inspection_id = p_inspection_id
    and database_item.organization_id = current_organization;

  get diagnostics updated_item_count = row_count;
  if updated_item_count <> database_item_count then
    raise exception 'Nem todos os itens puderam ser atualizados';
  end if;

  -- Mantém histórico: pendência deixa de existir operacionalmente quando item volta a ficar conforme.
  update public.nonconformities nonconformity
  set status = 'cancelled',
      resolved_at = coalesce(nonconformity.resolved_at, now()),
      updated_at = now()
  where nonconformity.inspection_id = p_inspection_id
    and nonconformity.organization_id = current_organization
    and nonconformity.inspection_item_id is not null
    and nonconformity.status not in ('validated', 'cancelled')
    and not exists (
      select 1
      from public.inspection_items inspection_item
      where inspection_item.id = nonconformity.inspection_item_id
        and inspection_item.condition in ('attention', 'non_compliant')
    );

  -- Atualiza pendências já criadas. Se item voltar a apresentar problema, reabre.
  update public.nonconformities nonconformity
  set title = case inspection_item.condition
        when 'attention' then 'Atenção: '
        else 'Não conformidade: '
      end || inspection_item.item_name,
      description = inspection_item.notes,
      source_condition = inspection_item.condition,
      severity = case inspection_item.condition
        when 'attention' then 'medium'
        else 'high'
      end,
      status = case
        when nonconformity.status in ('validated', 'cancelled') then 'open'
        else nonconformity.status
      end,
      due_date = case
        when nonconformity.status in ('validated', 'cancelled') or nonconformity.due_date is null
          then current_date + case inspection_item.condition when 'attention' then 14 else 7 end
        else nonconformity.due_date
      end,
      resolved_at = case when nonconformity.status in ('validated', 'cancelled') then null else nonconformity.resolved_at end,
      validated_at = case when nonconformity.status in ('validated', 'cancelled') then null else nonconformity.validated_at end,
      validated_by = case when nonconformity.status in ('validated', 'cancelled') then null else nonconformity.validated_by end,
      updated_at = now()
  from public.inspection_items inspection_item
  where nonconformity.inspection_item_id = inspection_item.id
    and nonconformity.inspection_id = p_inspection_id
    and nonconformity.organization_id = current_organization
    and inspection_item.inspection_id = p_inspection_id
    and inspection_item.organization_id = current_organization
    and inspection_item.condition in ('attention', 'non_compliant');

  -- Cria uma pendência para cada item de Atenção ou Não conforme ainda sem registro.
  insert into public.nonconformities (
    organization_id, inspection_id, inspection_item_id, property_id,
    title, description, source_condition, severity, status, due_date, created_by
  )
  select
    current_organization,
    p_inspection_id,
    inspection_item.id,
    inspection_record.property_id,
    case inspection_item.condition
      when 'attention' then 'Atenção: '
      else 'Não conformidade: '
    end || inspection_item.item_name,
    inspection_item.notes,
    inspection_item.condition,
    case inspection_item.condition when 'attention' then 'medium' else 'high' end,
    'open',
    current_date + case inspection_item.condition when 'attention' then 14 else 7 end,
    auth.uid()
  from public.inspection_items inspection_item
  where inspection_item.inspection_id = p_inspection_id
    and inspection_item.organization_id = current_organization
    and inspection_item.condition in ('attention', 'non_compliant')
    and not exists (
      select 1
      from public.nonconformities existing_issue
      where existing_issue.organization_id = current_organization
        and existing_issue.inspection_id = p_inspection_id
        and existing_issue.inspection_item_id = inspection_item.id
    );

  select coalesce(round(
    sum((case condition
      when 'compliant' then 100
      when 'attention' then 65
      when 'non_compliant' then 20
      else 0
    end) * weight) / nullif(sum(weight), 0)
  ), 100)::smallint
  into calculated_score
  from public.inspection_items
  where inspection_id = p_inspection_id
    and organization_id = current_organization
    and condition <> 'not_applicable';

  update public.inspections
  set status = 'completed',
      started_at = coalesce(started_at, scheduled_at, now()),
      completed_at = now(),
      quality_score = calculated_score,
      general_notes = nullif(trim(p_general_notes), '')
  where id = p_inspection_id
    and organization_id = current_organization
  returning * into completed_inspection;

  return completed_inspection;
end;
$$;

-- Mudanças de status passam por transições controladas no banco.
create or replace function public.update_nonconformity_status(
  p_nonconformity_id uuid,
  p_status text
)
returns public.nonconformities
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_organization uuid;
  current_issue public.nonconformities;
  updated_issue public.nonconformities;
begin
  current_organization := private.current_organization_id();
  if current_organization is null then
    raise exception 'Usuário sem organização ativa';
  end if;

  select * into current_issue
  from public.nonconformities
  where id = p_nonconformity_id
    and organization_id = current_organization
  for update;

  if not found then
    raise exception 'Pendência não encontrada ou sem permissão de acesso';
  end if;
  if p_status not in ('in_progress', 'awaiting_validation', 'validated', 'cancelled') then
    raise exception 'Status de destino inválido';
  end if;
  if not (
    (current_issue.status = 'open' and p_status in ('in_progress', 'cancelled'))
    or (current_issue.status = 'in_progress' and p_status in ('awaiting_validation', 'cancelled'))
    or (current_issue.status = 'awaiting_validation' and p_status in ('in_progress', 'validated', 'cancelled'))
  ) then
    raise exception 'Transição de status não permitida: % para %', current_issue.status, p_status;
  end if;
  if p_status in ('validated', 'cancelled') and not private.can_manage() then
    raise exception 'Somente administradores e gestores podem validar ou cancelar pendências';
  end if;

  update public.nonconformities
  set status = p_status,
      assigned_to = case
        when p_status = 'in_progress' then coalesce(assigned_to, auth.uid())
        else assigned_to
      end,
      resolved_at = case when p_status in ('validated', 'cancelled') then now() else null end,
      validated_at = case when p_status = 'validated' then now() else null end,
      validated_by = case when p_status = 'validated' then auth.uid() else null end,
      updated_at = now()
  where id = p_nonconformity_id
    and organization_id = current_organization
  returning * into updated_issue;

  return updated_issue;
end;
$$;

-- Traz resultados problemáticos de vistorias já concluídas antes desta migração.
insert into public.nonconformities (
  organization_id, inspection_id, inspection_item_id, property_id,
  title, description, source_condition, severity, status, due_date, created_by
)
select
  inspection.organization_id,
  inspection.id,
  inspection_item.id,
  inspection.property_id,
  case inspection_item.condition
    when 'attention' then 'Atenção: '
    else 'Não conformidade: '
  end || inspection_item.item_name,
  inspection_item.notes,
  inspection_item.condition,
  case inspection_item.condition when 'attention' then 'medium' else 'high' end,
  'open',
  coalesce(inspection.completed_at::date, current_date)
    + case inspection_item.condition when 'attention' then 14 else 7 end,
  inspection.inspector_id
from public.inspections inspection
join public.inspection_items inspection_item
  on inspection_item.inspection_id = inspection.id
 and inspection_item.organization_id = inspection.organization_id
where inspection.status = 'completed'
  and inspection_item.condition in ('attention', 'non_compliant')
  and not exists (
    select 1
    from public.nonconformities existing_issue
    where existing_issue.organization_id = inspection.organization_id
      and existing_issue.inspection_id = inspection.id
      and existing_issue.inspection_item_id = inspection_item.id
  );

revoke all on function public.complete_inspection(uuid, text, jsonb) from public;
grant execute on function public.complete_inspection(uuid, text, jsonb) to authenticated;
revoke all on function public.update_nonconformity_status(uuid, text) from public;
grant execute on function public.update_nonconformity_status(uuid, text) to authenticated;

-- Evita escrita direta que contorne geração automática e transições controladas.
-- Leitura continua liberada pela RLS da organização.
revoke insert, update, delete on public.nonconformities from authenticated;

comment on column public.nonconformities.source_condition is
  'Resultado de origem: Atenção ou Não conforme.';
comment on function public.complete_inspection(uuid, text, jsonb) is
  'Conclui vistoria e sincroniza pendências de correção atomicamente.';
comment on function public.update_nonconformity_status(uuid, text) is
  'Controla transições e validação das pendências dentro da organização do usuário.';

commit;

-- Validação opcional:
-- select source_condition, status, count(*)
-- from public.nonconformities
-- group by source_condition, status
-- order by source_condition, status;

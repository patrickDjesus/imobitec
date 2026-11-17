-- Imobitec | Conclusão transacional de vistorias
-- Pré-requisito: executar 001 a 010 em ordem.
-- Execute este arquivo no Supabase SQL Editor.

begin;

alter table public.inspection_items
  drop constraint if exists inspection_items_condition_check;
alter table public.inspection_items
  add constraint inspection_items_condition_check
  check (condition in ('pending', 'compliant', 'attention', 'non_compliant', 'not_applicable'));

-- Preenche ambientes antigos que ainda não receberam snapshot de checklist.
create or replace function public.prepare_inspection_completion(p_inspection_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_organization uuid;
  inserted_count integer;
begin
  current_organization := private.current_organization_id();
  if current_organization is null then
    raise exception 'Usuário sem organização ativa';
  end if;

  if not exists (
    select 1 from public.inspections
    where id = p_inspection_id and organization_id = current_organization
  ) then
    raise exception 'Vistoria não encontrada ou sem permissão de acesso';
  end if;

  insert into public.inspection_items (
    organization_id, inspection_id, inspection_environment_id,
    source_template_item_id, item_name, category, condition, is_required, weight
  )
  select
    environment.organization_id,
    environment.inspection_id,
    environment.id,
    template_item.id,
    template_item.item_name,
    template_item.category,
    'pending',
    template_item.is_required,
    1
  from public.inspection_environments environment
  join public.inspection_checklist_templates template
    on template.organization_id = environment.organization_id
   and template.environment_type = environment.environment_type
   and template.is_active = true
  join public.inspection_checklist_template_items template_item
    on template_item.template_id = template.id
   and template_item.organization_id = template.organization_id
  where environment.inspection_id = p_inspection_id
    and environment.organization_id = current_organization
    and not exists (
      select 1 from public.inspection_items existing_item
      where existing_item.inspection_environment_id = environment.id
        and existing_item.organization_id = current_organization
    )
  order by environment.sort_order, template_item.sort_order;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.prepare_inspection_completion(uuid) from public;
grant execute on function public.prepare_inspection_completion(uuid) to authenticated;

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

  perform 1
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

revoke all on function public.complete_inspection(uuid, text, jsonb) from public;
grant execute on function public.complete_inspection(uuid, text, jsonb) to authenticated;

comment on function public.prepare_inspection_completion(uuid) is
  'Cria snapshots ausentes para ambientes antigos antes da conclusão.';
comment on function public.complete_inspection(uuid, text, jsonb) is
  'Grava todos os resultados, calcula qualidade e conclui vistoria na mesma transação.';

commit;

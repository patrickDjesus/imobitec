-- Imobitec | Correções consolidadas da auditoria estrutural e de segurança
-- Pré-requisito: migrações 001 a 015.
--
-- IMPORTANTE:
-- 1. Faça backup antes de executar.
-- 2. Esta migração remove quatro colunas obsoletas de public.properties.
-- 3. A transação é interrompida sem alterações caso encontre imóveis
--    incompatíveis ou não conformidades duplicadas para o mesmo item.

begin;

-- ---------------------------------------------------------------------------
-- 1. Pré-validações: não inventar nem apagar dados inconsistentes silenciosamente.
-- ---------------------------------------------------------------------------

do $$
declare
  invalid_property_count bigint;
  duplicate_nonconformity_count bigint;
begin
  select count(*)
    into invalid_property_count
  from public.properties
  where name is null
     or char_length(btrim(name)) not between 1 and 250
     or address_line is null
     or char_length(btrim(address_line)) not between 1 and 250
     or district is null
     or char_length(btrim(district)) not between 1 and 250
     or city is null
     or char_length(btrim(city)) not between 1 and 250
     or (complement is not null and char_length(complement) > 250)
     or room_count is null
     or room_count not between 0 and 99999;

  if invalid_property_count > 0 then
    raise exception
      'Existem % imóvel(is) com endereço ou quantidade de cômodos incompatível. Corrija-os antes de executar a migração 016.',
      invalid_property_count;
  end if;

  select count(*)
    into duplicate_nonconformity_count
  from (
    select organization_id, inspection_id, inspection_item_id
    from public.nonconformities
    where inspection_item_id is not null
    group by organization_id, inspection_id, inspection_item_id
    having count(*) > 1
  ) duplicates;

  if duplicate_nonconformity_count > 0 then
    raise exception
      'Existem % grupo(s) de não conformidades duplicadas por item. Corrija-os antes de executar a migração 016.',
      duplicate_nonconformity_count;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Corrige IDs numéricos que existem sem geração automática.
-- ---------------------------------------------------------------------------

do $$
declare
  identity_flag text;
  sequence_name regclass;
  next_value bigint;
begin
  select is_identity
    into identity_flag
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'properties'
    and column_name = 'property_number';

  if identity_flag is null then
    raise exception 'Coluna public.properties.property_number não encontrada';
  end if;

  if identity_flag = 'NO' then
    alter table public.properties
      alter column property_number drop default;
    alter table public.properties
      alter column property_number add generated always as identity;
  end if;

  sequence_name := pg_get_serial_sequence('public.properties', 'property_number')::regclass;
  if sequence_name is null then
    raise exception 'Sequência de public.properties.property_number não encontrada';
  end if;

  select coalesce(max(property_number), 0) + 1
    into next_value
  from public.properties;

  perform pg_catalog.setval(sequence_name, next_value, false);
  execute format('grant usage, select on sequence %s to authenticated', sequence_name);
end;
$$;

do $$
declare
  identity_flag text;
  sequence_name regclass;
  next_value bigint;
begin
  select is_identity
    into identity_flag
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'inspections'
    and column_name = 'inspection_number';

  if identity_flag is null then
    raise exception 'Coluna public.inspections.inspection_number não encontrada';
  end if;

  if identity_flag = 'NO' then
    alter table public.inspections
      alter column inspection_number drop default;
    alter table public.inspections
      alter column inspection_number add generated always as identity;
  end if;

  sequence_name := pg_get_serial_sequence('public.inspections', 'inspection_number')::regclass;
  if sequence_name is null then
    raise exception 'Sequência de public.inspections.inspection_number não encontrada';
  end if;

  select coalesce(max(inspection_number), 0) + 1
    into next_value
  from public.inspections;

  perform pg_catalog.setval(sequence_name, next_value, false);
  execute format('grant usage, select on sequence %s to authenticated', sequence_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Aplica simplificação do imóvel e reforça endereço obrigatório.
-- ---------------------------------------------------------------------------

alter table public.properties
  drop constraint if exists properties_counts_check,
  drop constraint if exists properties_room_count_check,
  drop constraint if exists properties_address_lengths_check;

alter table public.properties
  drop column if exists bedroom_count,
  drop column if exists bathroom_count,
  drop column if exists garage_space_count,
  drop column if exists pool_count;

alter table public.properties
  alter column district set not null;

alter table public.properties
  add constraint properties_room_count_check
    check (room_count between 0 and 99999),
  add constraint properties_address_lengths_check check (
    char_length(btrim(name)) between 1 and 250
    and char_length(btrim(address_line)) between 1 and 250
    and char_length(btrim(district)) between 1 and 250
    and char_length(btrim(city)) between 1 and 250
    and (complement is null or char_length(complement) <= 250)
  );

comment on column public.properties.room_count is
  'Quantidade total máxima de ambientes que poderá ser discriminada em cada vistoria.';
comment on column public.properties.district is
  'Bairro obrigatório do imóvel.';

-- ---------------------------------------------------------------------------
-- 4. Corrige privilégios excessivos. RLS não protege TRUNCATE.
-- ---------------------------------------------------------------------------

revoke all on public.inspection_checklist_templates from authenticated;
revoke all on public.inspection_checklist_template_items from authenticated;

grant select, insert, update, delete
  on public.inspection_checklist_templates
  to authenticated;
grant select, insert, update, delete
  on public.inspection_checklist_template_items
  to authenticated;

-- Escritas operacionais passam exclusivamente pelas funções transacionais.
revoke insert, update on public.inspections from authenticated;
revoke insert, update, delete on public.inspection_environments from authenticated;
revoke insert, update, delete on public.inspection_items from authenticated;
revoke insert, update, delete on public.nonconformities from authenticated;

-- Mantém leitura normal e exclusão administrativa de vistorias.
grant select, delete on public.inspections to authenticated;
grant select on public.inspection_environments to authenticated;
grant select on public.inspection_items to authenticated;
grant select on public.nonconformities to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Novos cadastros não recebem acesso automático à imobiliária.
--    Administrador deve ativar perfil aprovado depois do cadastro.
-- ---------------------------------------------------------------------------

alter table public.profiles
  alter column is_active set default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, is_active, organization_id)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    'inspector',
    false,
    '00000000-0000-4000-8000-000000000001'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

comment on function public.handle_new_user() is
  'Cria perfil inativo; acesso depende de aprovação administrativa.';

-- ---------------------------------------------------------------------------
-- 6. Registra responsável imutável pela validação de cada não conformidade.
-- ---------------------------------------------------------------------------

alter table public.nonconformities
  add column if not exists validation_responsible_id uuid;

update public.nonconformities nonconformity
set validation_responsible_id = inspection.inspector_id
from public.inspections inspection
where inspection.id = nonconformity.inspection_id
  and inspection.organization_id = nonconformity.organization_id
  and nonconformity.validation_responsible_id is null;

do $$
begin
  if exists (
    select 1
    from public.nonconformities
    where validation_responsible_id is null
  ) then
    raise exception 'Existem não conformidades sem responsável de validação';
  end if;
end;
$$;

alter table public.nonconformities
  alter column validation_responsible_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nonconformities'::regclass
      and conname = 'nonconformities_validation_responsible_id_fkey'
  ) then
    alter table public.nonconformities
      add constraint nonconformities_validation_responsible_id_fkey
      foreign key (validation_responsible_id)
      references auth.users(id);
  end if;
end;
$$;

create unique index if not exists nonconformities_inspection_item_key
  on public.nonconformities (organization_id, inspection_id, inspection_item_id)
  where inspection_item_id is not null;

create index if not exists nonconformities_inspection_idx
  on public.nonconformities (organization_id, inspection_id);

comment on column public.nonconformities.validation_responsible_id is
  'Snapshot do responsável pela vistoria no momento da geração da pendência.';

-- ---------------------------------------------------------------------------
-- 7. Criação de vistoria: função passa a controlar toda escrita.
-- ---------------------------------------------------------------------------

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
security definer
set search_path = ''
as $$
declare
  current_organization uuid;
  new_inspection public.inspections;
  environment jsonb;
  environment_position integer;
  environment_count integer;
  property_room_count integer;
begin
  current_organization := private.current_organization_id();
  if current_organization is null then
    raise exception 'Usuário sem organização ativa';
  end if;

  if p_inspection_type is null
     or p_inspection_type not in ('entry', 'exit', 'periodic', 'maintenance') then
    raise exception 'Tipo de vistoria inválido';
  end if;
  if p_scheduled_at is null then
    raise exception 'Data e horário da vistoria são obrigatórios';
  end if;
  if p_status is null or p_status not in ('draft', 'in_progress', 'cancelled') then
    raise exception 'Status inicial inválido para vistoria';
  end if;
  if p_environments is null or jsonb_typeof(p_environments) is distinct from 'array' then
    raise exception 'Ambientes precisam ser enviados como lista';
  end if;

  environment_count := jsonb_array_length(p_environments);
  if p_room_count is null or p_room_count < 1 then
    raise exception 'Informe pelo menos um cômodo para vistoriar';
  end if;
  if environment_count <> p_room_count then
    raise exception
      'Quantidade de ambientes (%) precisa corresponder aos cômodos da vistoria (%)',
      environment_count,
      p_room_count;
  end if;

  select room_count
    into property_room_count
  from public.properties
  where id = p_property_id
    and organization_id = current_organization;

  if not found then
    raise exception 'Imóvel não encontrado ou sem permissão de acesso';
  end if;
  if p_room_count > property_room_count then
    raise exception
      'Cômodos da vistoria (%) excedem limite do imóvel (%)',
      p_room_count,
      property_room_count;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_inspector_id
      and organization_id = current_organization
      and is_active = true
  ) then
    raise exception 'Responsável inválido ou inativo';
  end if;

  insert into public.inspections (
    organization_id,
    property_id,
    inspection_type,
    scheduled_at,
    inspector_id,
    status,
    room_count
  ) values (
    current_organization,
    p_property_id,
    p_inspection_type,
    p_scheduled_at,
    p_inspector_id,
    p_status,
    p_room_count
  )
  returning * into new_inspection;

  for environment, environment_position in
    select value, ordinality::integer - 1
    from jsonb_array_elements(p_environments) with ordinality
  loop
    insert into public.inspection_environments (
      organization_id,
      inspection_id,
      environment_type,
      name,
      sort_order
    ) values (
      current_organization,
      new_inspection.id,
      environment ->> 'type',
      btrim(environment ->> 'name'),
      environment_position
    );
  end loop;

  return new_inspection;
end;
$$;

revoke all on function public.create_inspection_with_environments(
  uuid, text, timestamptz, uuid, text, integer, jsonb
) from public;
grant execute on function public.create_inspection_with_environments(
  uuid, text, timestamptz, uuid, text, integer, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Edição de vistoria: bloqueia concluídas/canceladas e conclusão direta.
-- ---------------------------------------------------------------------------

create or replace function public.update_inspection_with_environments(
  p_inspection_id uuid,
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
security definer
set search_path = ''
as $$
declare
  current_organization uuid;
  current_inspection public.inspections;
  updated_inspection public.inspections;
  environment jsonb;
  environment_position integer;
  environment_count integer;
  property_room_count integer;
begin
  current_organization := private.current_organization_id();
  if current_organization is null then
    raise exception 'Usuário sem organização ativa';
  end if;

  select *
    into current_inspection
  from public.inspections
  where id = p_inspection_id
    and organization_id = current_organization
  for update;

  if not found then
    raise exception 'Vistoria não encontrada ou sem permissão de acesso';
  end if;
  if current_inspection.status in ('completed', 'cancelled') then
    raise exception 'Vistoria concluída ou cancelada não pode ser editada';
  end if;
  if p_inspection_type is null
     or p_inspection_type not in ('entry', 'exit', 'periodic', 'maintenance') then
    raise exception 'Tipo de vistoria inválido';
  end if;
  if p_scheduled_at is null then
    raise exception 'Data e horário da vistoria são obrigatórios';
  end if;
  if p_status is null or p_status not in ('draft', 'in_progress', 'cancelled') then
    raise exception 'Conclusão deve ser feita pelo fluxo de checklist';
  end if;
  if p_environments is null or jsonb_typeof(p_environments) is distinct from 'array' then
    raise exception 'Ambientes precisam ser enviados como lista';
  end if;

  environment_count := jsonb_array_length(p_environments);
  if p_room_count is null or p_room_count < 1 then
    raise exception 'Informe pelo menos um cômodo para vistoriar';
  end if;
  if environment_count <> p_room_count then
    raise exception
      'Quantidade de ambientes (%) precisa corresponder aos cômodos da vistoria (%)',
      environment_count,
      p_room_count;
  end if;

  select room_count
    into property_room_count
  from public.properties
  where id = p_property_id
    and organization_id = current_organization;

  if not found then
    raise exception 'Imóvel não encontrado ou sem permissão de acesso';
  end if;
  if p_room_count > property_room_count then
    raise exception
      'Cômodos da vistoria (%) excedem limite do imóvel (%)',
      p_room_count,
      property_room_count;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_inspector_id
      and organization_id = current_organization
      and is_active = true
  ) then
    raise exception 'Responsável inválido ou inativo';
  end if;

  delete from public.inspection_environments
  where inspection_id = p_inspection_id
    and organization_id = current_organization;

  update public.inspections
  set property_id = p_property_id,
      inspection_type = p_inspection_type,
      scheduled_at = p_scheduled_at,
      inspector_id = p_inspector_id,
      status = p_status,
      room_count = p_room_count
  where id = p_inspection_id
    and organization_id = current_organization
  returning * into updated_inspection;

  for environment, environment_position in
    select value, ordinality::integer - 1
    from jsonb_array_elements(p_environments) with ordinality
  loop
    insert into public.inspection_environments (
      organization_id,
      inspection_id,
      environment_type,
      name,
      sort_order
    ) values (
      current_organization,
      p_inspection_id,
      environment ->> 'type',
      btrim(environment ->> 'name'),
      environment_position
    );
  end loop;

  return updated_inspection;
end;
$$;

revoke all on function public.update_inspection_with_environments(
  uuid, uuid, text, timestamptz, uuid, text, integer, jsonb
) from public;
grant execute on function public.update_inspection_with_environments(
  uuid, uuid, text, timestamptz, uuid, text, integer, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Conclusão única, cobertura completa e geração segura de pendências.
-- ---------------------------------------------------------------------------

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
  inspection_record public.inspections;
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

  select *
    into inspection_record
  from public.inspections
  where id = p_inspection_id
    and organization_id = current_organization
  for update;

  if not found then
    raise exception 'Vistoria não encontrada ou sem permissão de acesso';
  end if;
  if inspection_record.status <> 'in_progress' then
    raise exception 'Somente vistoria em andamento pode ser concluída';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Resultados precisam ser enviados como lista';
  end if;

  if not exists (
    select 1
    from public.inspection_environments
    where inspection_id = p_inspection_id
      and organization_id = current_organization
  ) then
    raise exception 'Vistoria não possui ambientes cadastrados';
  end if;

  if exists (
    select 1
    from public.inspection_environments environment
    where environment.inspection_id = p_inspection_id
      and environment.organization_id = current_organization
      and not exists (
        select 1
        from public.inspection_items inspection_item
        where inspection_item.inspection_environment_id = environment.id
          and inspection_item.inspection_id = p_inspection_id
          and inspection_item.organization_id = current_organization
      )
  ) then
    raise exception 'Todos os ambientes precisam possuir checklist antes da conclusão';
  end if;

  select count(*)
    into database_item_count
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
    select 1
    from jsonb_array_elements(p_items) item
    where coalesce(item ->> 'condition', '') not in (
      'compliant', 'attention', 'non_compliant', 'not_applicable'
    )
  ) then
    raise exception 'Resultado inválido no checklist';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where item ->> 'condition' in ('attention', 'non_compliant')
      and nullif(btrim(coalesce(item ->> 'notes', '')), '') is null
  ) then
    raise exception 'Itens de Atenção ou Não conforme precisam de observação';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where not exists (
      select 1
      from public.inspection_items database_item
      where database_item.id = (item ->> 'id')::uuid
        and database_item.inspection_id = p_inspection_id
        and database_item.organization_id = current_organization
    )
  ) then
    raise exception 'Item não pertence a esta vistoria';
  end if;

  update public.inspection_items database_item
  set condition = item ->> 'condition',
      notes = nullif(btrim(item ->> 'notes'), '')
  from jsonb_array_elements(p_items) item
  where database_item.id = (item ->> 'id')::uuid
    and database_item.inspection_id = p_inspection_id
    and database_item.organization_id = current_organization;

  get diagnostics updated_item_count = row_count;
  if updated_item_count <> database_item_count then
    raise exception 'Nem todos os itens puderam ser atualizados';
  end if;

  insert into public.nonconformities (
    organization_id,
    inspection_id,
    inspection_item_id,
    property_id,
    title,
    description,
    source_condition,
    severity,
    status,
    due_date,
    created_by,
    validation_responsible_id
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
    case inspection_item.condition
      when 'attention' then 'medium'
      else 'high'
    end,
    'open',
    current_date + case inspection_item.condition when 'attention' then 14 else 7 end,
    auth.uid(),
    inspection_record.inspector_id
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
      general_notes = nullif(btrim(p_general_notes), '')
  where id = p_inspection_id
    and organization_id = current_organization
  returning * into completed_inspection;

  return completed_inspection;
end;
$$;

revoke all on function public.complete_inspection(uuid, text, jsonb) from public;
grant execute on function public.complete_inspection(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Validação usa responsável imutável salvo na pendência.
-- ---------------------------------------------------------------------------

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

  select *
    into current_issue
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
    raise exception
      'Transição de status não permitida: % para %',
      current_issue.status,
      p_status;
  end if;

  if p_status = 'validated'
     and current_issue.validation_responsible_id <> auth.uid() then
    raise exception 'Somente o responsável pela vistoria pode validar a correção';
  end if;

  if p_status = 'cancelled' and not private.can_manage() then
    raise exception 'Somente administradores e gestores podem cancelar pendências';
  end if;

  update public.nonconformities
  set status = p_status,
      assigned_to = case
        when p_status = 'in_progress' then coalesce(assigned_to, auth.uid())
        else assigned_to
      end,
      resolved_at = case
        when p_status in ('validated', 'cancelled') then now()
        else null
      end,
      validated_at = case when p_status = 'validated' then now() else null end,
      validated_by = case when p_status = 'validated' then auth.uid() else null end,
      updated_at = now()
  where id = p_nonconformity_id
    and organization_id = current_organization
  returning * into updated_issue;

  return updated_issue;
end;
$$;

revoke all on function public.update_nonconformity_status(uuid, text) from public;
grant execute on function public.update_nonconformity_status(uuid, text) to authenticated;

comment on function public.complete_inspection(uuid, text, jsonb) is
  'Conclui uma única vez, exige checklist para todos os ambientes e gera pendências com responsável imutável.';
comment on function public.update_nonconformity_status(uuid, text) is
  'Controla correção; validação final exige responsável salvo na pendência.';

commit;

-- Validação após executar:
--
-- select table_name, column_name, is_identity, identity_generation
-- from information_schema.columns
-- where table_schema = 'public'
--   and (table_name, column_name) in (
--     ('properties', 'property_number'),
--     ('inspections', 'inspection_number')
--   );
--
-- select grantee, table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and grantee = 'authenticated'
--   and table_name in (
--     'inspection_checklist_templates',
--     'inspection_checklist_template_items'
--   )
-- order by table_name, privilege_type;
--
-- Novos perfis ficam inativos. Para aprovar conta pelo SQL Editor:
-- update public.profiles
-- set is_active = true, updated_at = now()
-- where id = '<UUID_DO_USUARIO_APROVADO>';

-- Imobitec | Checklist único por cômodo e validação pelo vistoriador
-- Pré-requisito: executar 001 a 014 em ordem.
-- Execute este arquivo no Supabase SQL Editor.

begin;

-- Interrompe migração sem apagar dados quando já houver duplicidade histórica.
do $$
begin
  if exists (
    select 1
    from public.inspection_checklist_templates
    group by organization_id, environment_type
    having count(*) > 1
  ) then
    raise exception 'Existem checklists duplicados para o mesmo cômodo. Exclua duplicados antes de executar esta migração.';
  end if;
end;
$$;

-- Um único checklist por cômodo, ativo ou inativo, dentro da imobiliária.
drop index if exists public.inspection_checklist_templates_active_environment_key;
create unique index if not exists inspection_checklist_templates_environment_key
  on public.inspection_checklist_templates (organization_id, environment_type);

create or replace function public.prevent_duplicate_inspection_checklist_environment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.inspection_checklist_templates template
    where template.organization_id = new.organization_id
      and template.environment_type = new.environment_type
      and template.id <> new.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'Para o cômodo selecionado já existe uma execução de vistoria cadastrada.';
  end if;

  return new;
end;
$$;

drop trigger if exists inspection_checklist_templates_prevent_duplicate_environment
  on public.inspection_checklist_templates;
create trigger inspection_checklist_templates_prevent_duplicate_environment
before insert or update of organization_id, environment_type
on public.inspection_checklist_templates
for each row execute procedure public.prevent_duplicate_inspection_checklist_environment();

-- Qualquer membro pode iniciar correção e enviar para validação.
-- Somente responsável definido em inspections.inspector_id pode validar.
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
  responsible_user_id uuid;
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

  if p_status = 'validated' then
    select inspection.inspector_id into responsible_user_id
    from public.inspections inspection
    where inspection.id = current_issue.inspection_id
      and inspection.organization_id = current_organization;

    if responsible_user_id is null or responsible_user_id <> auth.uid() then
      raise exception 'Somente o responsável pela vistoria pode validar a correção';
    end if;
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

revoke all on function public.update_nonconformity_status(uuid, text) from public;
grant execute on function public.update_nonconformity_status(uuid, text) to authenticated;

comment on function public.prevent_duplicate_inspection_checklist_environment() is
  'Impede mais de um checklist para o mesmo tipo de cômodo na organização.';
comment on function public.update_nonconformity_status(uuid, text) is
  'Controla correção; validação final exige usuário responsável pela vistoria.';

commit;

-- Validação opcional:
-- select organization_id, environment_type, count(*)
-- from public.inspection_checklist_templates
-- group by organization_id, environment_type
-- having count(*) > 1;

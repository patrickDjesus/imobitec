-- Imobitec | Edição atômica dos modelos de checklist
-- Pré-requisito: executar 001 a 009 em ordem.
-- Execute este arquivo no Supabase SQL Editor.

begin;

create or replace function public.update_inspection_checklist_template(
  p_template_id uuid,
  p_name text,
  p_environment_type text,
  p_is_active boolean,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_organization uuid;
  existing_template public.inspection_checklist_templates;
  updated_template public.inspection_checklist_templates;
  item jsonb;
  item_position integer;
  result jsonb;
begin
  if not private.can_manage() then
    raise exception 'Somente administradores e gestores podem editar checklists';
  end if;

  current_organization := private.current_organization_id();
  if current_organization is null then
    raise exception 'Usuário não pertence a uma organização';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) is distinct from 'array'
     or coalesce(jsonb_array_length(p_items), 0) < 1 then
    raise exception 'Informe pelo menos um item para inspeção';
  end if;

  select * into existing_template
  from public.inspection_checklist_templates
  where id = p_template_id
    and organization_id = current_organization
  for update;

  if not found then
    raise exception 'Modelo de checklist não encontrado';
  end if;

  update public.inspection_checklist_templates
  set name = trim(p_name),
      environment_type = p_environment_type,
      is_active = p_is_active
  where id = existing_template.id
    and organization_id = current_organization
  returning * into updated_template;

  delete from public.inspection_checklist_template_items
  where template_id = updated_template.id
    and organization_id = current_organization;

  for item, item_position in
    select value, ordinality::integer - 1
    from jsonb_array_elements(p_items) with ordinality
  loop
    insert into public.inspection_checklist_template_items (
      organization_id, template_id, item_name, category, is_required, sort_order
    ) values (
      current_organization,
      updated_template.id,
      trim(item ->> 'item_name'),
      item ->> 'category',
      coalesce((item ->> 'is_required')::boolean, true),
      item_position
    );
  end loop;

  select to_jsonb(updated_template) || jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(template_item) order by template_item.sort_order), '[]'::jsonb)
  ) into result
  from public.inspection_checklist_template_items template_item
  where template_item.template_id = updated_template.id;

  return result;
end;
$$;

revoke all on function public.update_inspection_checklist_template(uuid, text, text, boolean, jsonb) from public;
grant execute on function public.update_inspection_checklist_template(uuid, text, text, boolean, jsonb) to authenticated;

comment on function public.update_inspection_checklist_template(uuid, text, text, boolean, jsonb) is
  'Atualiza modelo e substitui seus itens na mesma transação, preservando snapshots já copiados para vistorias.';

commit;

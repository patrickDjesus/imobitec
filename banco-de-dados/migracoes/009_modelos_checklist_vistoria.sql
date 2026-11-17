-- Imobitec | Modelos de checklist por tipo de cômodo
-- Pré-requisito: executar 001 a 008 em ordem.
-- Execute este arquivo no Supabase SQL Editor.

begin;

create table if not exists public.inspection_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  environment_type text not null check (environment_type in (
    'living_room', 'dining_room', 'kitchen', 'bedroom', 'bathroom',
    'garage', 'laundry', 'office', 'balcony', 'hallway', 'pantry',
    'closet', 'pool', 'outdoor_area', 'other'
  )),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  template_id uuid not null references public.inspection_checklist_templates(id) on delete cascade,
  item_name text not null check (char_length(trim(item_name)) between 1 and 180),
  category text not null check (category in (
    'structure', 'finishing', 'installations', 'equipment',
    'cleaning', 'safety', 'other'
  )),
  is_required boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inspection_checklist_templates_name_ci_key
  on public.inspection_checklist_templates (organization_id, lower(trim(name)));
create unique index if not exists inspection_checklist_templates_active_environment_key
  on public.inspection_checklist_templates (organization_id, environment_type)
  where is_active = true;
create index if not exists inspection_checklist_templates_organization_idx
  on public.inspection_checklist_templates (organization_id, created_at desc);
create unique index if not exists inspection_checklist_template_items_name_ci_key
  on public.inspection_checklist_template_items (template_id, lower(trim(item_name)));
create index if not exists inspection_checklist_template_items_template_idx
  on public.inspection_checklist_template_items (template_id, sort_order);

drop trigger if exists inspection_checklist_templates_set_updated_at on public.inspection_checklist_templates;
create trigger inspection_checklist_templates_set_updated_at
before update on public.inspection_checklist_templates
for each row execute procedure public.set_updated_at();

drop trigger if exists inspection_checklist_template_items_set_updated_at on public.inspection_checklist_template_items;
create trigger inspection_checklist_template_items_set_updated_at
before update on public.inspection_checklist_template_items
for each row execute procedure public.set_updated_at();

alter table public.inspection_checklist_templates enable row level security;
alter table public.inspection_checklist_template_items enable row level security;

drop policy if exists "inspection_checklist_templates_select_member" on public.inspection_checklist_templates;
create policy "inspection_checklist_templates_select_member" on public.inspection_checklist_templates
for select to authenticated
using (organization_id = (select private.current_organization_id()));

drop policy if exists "inspection_checklist_templates_insert_manager" on public.inspection_checklist_templates;
create policy "inspection_checklist_templates_insert_manager" on public.inspection_checklist_templates
for insert to authenticated
with check (organization_id = (select private.current_organization_id()) and (select private.can_manage()));

drop policy if exists "inspection_checklist_templates_update_manager" on public.inspection_checklist_templates;
create policy "inspection_checklist_templates_update_manager" on public.inspection_checklist_templates
for update to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.can_manage()))
with check (organization_id = (select private.current_organization_id()) and (select private.can_manage()));

drop policy if exists "inspection_checklist_templates_delete_admin" on public.inspection_checklist_templates;
create policy "inspection_checklist_templates_delete_admin" on public.inspection_checklist_templates
for delete to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.is_admin()));

drop policy if exists "inspection_checklist_template_items_select_member" on public.inspection_checklist_template_items;
create policy "inspection_checklist_template_items_select_member" on public.inspection_checklist_template_items
for select to authenticated
using (organization_id = (select private.current_organization_id()));

drop policy if exists "inspection_checklist_template_items_insert_manager" on public.inspection_checklist_template_items;
create policy "inspection_checklist_template_items_insert_manager" on public.inspection_checklist_template_items
for insert to authenticated
with check (organization_id = (select private.current_organization_id()) and (select private.can_manage()));

drop policy if exists "inspection_checklist_template_items_update_manager" on public.inspection_checklist_template_items;
create policy "inspection_checklist_template_items_update_manager" on public.inspection_checklist_template_items
for update to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.can_manage()))
with check (organization_id = (select private.current_organization_id()) and (select private.can_manage()));

drop policy if exists "inspection_checklist_template_items_delete_admin" on public.inspection_checklist_template_items;
create policy "inspection_checklist_template_items_delete_admin" on public.inspection_checklist_template_items
for delete to authenticated
using (organization_id = (select private.current_organization_id()) and (select private.is_admin()));

revoke all on public.inspection_checklist_templates from anon;
revoke all on public.inspection_checklist_template_items from anon;
grant select, insert, update, delete on public.inspection_checklist_templates to authenticated;
grant select, insert, update, delete on public.inspection_checklist_template_items to authenticated;

-- Cria modelo e itens na mesma transação.
create or replace function public.create_inspection_checklist_template(
  p_name text,
  p_environment_type text,
  p_is_active boolean,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_template public.inspection_checklist_templates;
  item jsonb;
  item_position integer;
  result jsonb;
begin
  if not private.can_manage() then
    raise exception 'Somente administradores e gestores podem cadastrar checklists';
  end if;
  if p_items is null
     or jsonb_typeof(p_items) is distinct from 'array'
     or coalesce(jsonb_array_length(p_items), 0) < 1 then
    raise exception 'Informe pelo menos um item para inspeção';
  end if;

  insert into public.inspection_checklist_templates (name, environment_type, is_active)
  values (trim(p_name), p_environment_type, p_is_active)
  returning * into new_template;

  for item, item_position in
    select value, ordinality::integer - 1
    from jsonb_array_elements(p_items) with ordinality
  loop
    insert into public.inspection_checklist_template_items (
      organization_id, template_id, item_name, category, is_required, sort_order
    ) values (
      new_template.organization_id,
      new_template.id,
      trim(item ->> 'item_name'),
      item ->> 'category',
      coalesce((item ->> 'is_required')::boolean, true),
      item_position
    );
  end loop;

  select to_jsonb(new_template) || jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(template_item) order by template_item.sort_order), '[]'::jsonb)
  ) into result
  from public.inspection_checklist_template_items template_item
  where template_item.template_id = new_template.id;

  return result;
end;
$$;

revoke all on function public.create_inspection_checklist_template(text, text, boolean, jsonb) from public;
grant execute on function public.create_inspection_checklist_template(text, text, boolean, jsonb) to authenticated;

-- Campos de snapshot: vinculam item executado ao ambiente e ao modelo original.
alter table public.inspection_items
  add column if not exists inspection_environment_id uuid
    references public.inspection_environments(id) on delete cascade,
  add column if not exists source_template_item_id uuid
    references public.inspection_checklist_template_items(id) on delete set null,
  add column if not exists is_required boolean not null default true;

alter table public.inspection_items
  alter column condition set default 'pending';
alter table public.inspection_items
  drop constraint if exists inspection_items_condition_check;
alter table public.inspection_items
  add constraint inspection_items_condition_check
  check (condition in ('pending', 'compliant', 'attention', 'non_compliant'));

create index if not exists inspection_items_environment_idx
  on public.inspection_items (inspection_environment_id, created_at);
create unique index if not exists inspection_items_environment_template_key
  on public.inspection_items (inspection_environment_id, source_template_item_id)
  where inspection_environment_id is not null and source_template_item_id is not null;

-- Copia modelo ativo para vistoria. Snapshot mantém histórico mesmo se modelo mudar depois.
create or replace function public.snapshot_checklist_for_inspection_environment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.inspection_items (
    organization_id,
    inspection_id,
    inspection_environment_id,
    source_template_item_id,
    item_name,
    category,
    condition,
    is_required,
    weight
  )
  select
    new.organization_id,
    new.inspection_id,
    new.id,
    template_item.id,
    template_item.item_name,
    template_item.category,
    'pending',
    template_item.is_required,
    1
  from public.inspection_checklist_template_items template_item
  join public.inspection_checklist_templates template
    on template.id = template_item.template_id
   and template.organization_id = template_item.organization_id
  where template.organization_id = new.organization_id
    and template.environment_type = new.environment_type
    and template.is_active = true
  order by template_item.sort_order;

  return new;
end;
$$;

drop trigger if exists inspection_environments_snapshot_checklist on public.inspection_environments;
create trigger inspection_environments_snapshot_checklist
after insert on public.inspection_environments
for each row execute procedure public.snapshot_checklist_for_inspection_environment();

comment on table public.inspection_checklist_templates is
  'Modelos ativos de checklist vinculados a tipos de ambiente.';
comment on table public.inspection_checklist_template_items is
  'Itens reutilizáveis que compõem cada modelo de checklist.';
comment on column public.inspection_items.source_template_item_id is
  'Referência opcional ao item de modelo que originou snapshot da vistoria.';

commit;

-- Validação opcional:
-- select t.name, t.environment_type, t.is_active, i.sort_order, i.item_name, i.category
-- from public.inspection_checklist_templates t
-- join public.inspection_checklist_template_items i on i.template_id = t.id
-- order by t.created_at desc, i.sort_order;

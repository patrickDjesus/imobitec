-- Imobitec | Edição transacional de vistorias e ambientes
-- Pré-requisito: executar 001 a 007 em ordem.
-- Execute este arquivo no Supabase SQL Editor.

begin;

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
  current_organization_id uuid;
  updated_inspection public.inspections;
  environment jsonb;
  environment_position integer;
  environment_count integer;
  property_room_count integer;
begin
  current_organization_id := private.current_organization_id();
  if current_organization_id is null then
    raise exception 'Usuário sem organização ativa';
  end if;

  perform 1
  from public.inspections
  where id = p_inspection_id
    and organization_id = current_organization_id
  for update;

  if not found then
    raise exception 'Vistoria não encontrada ou sem permissão de acesso';
  end if;

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

  select room_count into property_room_count
  from public.properties
  where id = p_property_id
    and organization_id = current_organization_id;

  if not found then
    raise exception 'Imóvel não encontrado ou sem permissão de acesso';
  end if;
  if p_room_count > property_room_count then
    raise exception 'Cômodos da vistoria (%) excedem limite do imóvel (%)', p_room_count, property_room_count;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_inspector_id
      and organization_id = current_organization_id
      and is_active = true
  ) then
    raise exception 'Responsável inválido ou inativo';
  end if;

  -- Remove snapshot antigo antes de reduzir room_count. Qualquer erro posterior
  -- desfaz toda operação porque função executa na mesma transação.
  delete from public.inspection_environments
  where inspection_id = p_inspection_id
    and organization_id = current_organization_id;

  update public.inspections
  set property_id = p_property_id,
      inspection_type = p_inspection_type,
      scheduled_at = p_scheduled_at,
      inspector_id = p_inspector_id,
      status = p_status,
      room_count = p_room_count
  where id = p_inspection_id
    and organization_id = current_organization_id
  returning * into updated_inspection;

  for environment, environment_position in
    select value, ordinality::integer - 1
    from jsonb_array_elements(p_environments) with ordinality
  loop
    insert into public.inspection_environments (
      organization_id, inspection_id, environment_type, name, sort_order
    ) values (
      current_organization_id,
      p_inspection_id,
      environment ->> 'type',
      trim(environment ->> 'name'),
      environment_position
    );
  end loop;

  return updated_inspection;
end;
$$;

revoke all on function public.update_inspection_with_environments(uuid, uuid, text, timestamptz, uuid, text, integer, jsonb) from public;
grant execute on function public.update_inspection_with_environments(uuid, uuid, text, timestamptz, uuid, text, integer, jsonb) to authenticated;

comment on function public.update_inspection_with_environments(uuid, uuid, text, timestamptz, uuid, text, integer, jsonb) is
  'Atualiza vistoria e substitui seus ambientes atomicamente, limitada à organização do usuário.';

commit;

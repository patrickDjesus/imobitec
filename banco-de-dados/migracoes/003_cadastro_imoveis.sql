-- Imobitec | Cadastro detalhado de imóveis
-- Pré-requisito: executar 001_autenticacao_inicial.sql e 002_modelo_operacional.sql.
-- Mantém o UUID interno de properties.id e adiciona property_number como ID sequencial visível.
-- Execute este arquivo no Supabase SQL Editor.

begin;

alter table public.properties
  add column if not exists property_number bigint generated always as identity,
  add column if not exists classification text,
  add column if not exists street_type text,
  add column if not exists street_number integer,
  add column if not exists no_number boolean not null default false,
  add column if not exists complement text,
  add column if not exists notes text,
  add column if not exists unit_area numeric(12,2),
  add column if not exists land_area numeric(12,2),
  add column if not exists room_count integer not null default 0,
  add column if not exists bedroom_count integer not null default 0,
  add column if not exists bathroom_count integer not null default 0,
  add column if not exists garage_space_count integer not null default 0,
  add column if not exists pool_count integer not null default 0,
  add column if not exists updated_by uuid references auth.users(id);

-- Compatibilidade com estrutura criada pelo arquivo 002.
alter table public.properties
  drop constraint if exists properties_property_type_check,
  drop constraint if exists properties_status_check,
  alter column reference_code drop not null,
  alter column status set default 'active';

update public.properties
set
  classification = coalesce(
    classification,
    case when property_type = 'commercial' then 'commercial' else 'residential' end
  ),
  property_type = case property_type
    when 'house' then 'house'
    when 'apartment' then 'apartment'
    when 'studio' then 'studio'
    when 'commercial' then 'commercial_room'
    else 'undefined'
  end,
  status = case status
    when 'inactive' then 'inactive'
    else 'active'
  end,
  street_type = coalesce(street_type, 'undefined'),
  no_number = case
    when street_number is null and nullif(trim(address_number), '') is null then true
    else no_number
  end
where
  classification is null
  or property_type in ('house', 'apartment', 'studio', 'commercial', 'other')
  or status in ('available', 'occupied', 'maintenance')
  or street_type is null;

update public.properties
set street_number = trim(address_number)::integer
where street_number is null and trim(coalesce(address_number, '')) ~ '^[0-9]+$';

update public.properties
set no_number = (street_number is null);

update public.properties
set postal_code = regexp_replace(postal_code, '[^0-9]', '', 'g')
where postal_code is not null;

alter table public.properties
  alter column classification set not null,
  alter column street_type set not null,
  alter column postal_code set not null;

alter table public.properties
  drop constraint if exists properties_postal_code_check;
alter table public.properties
  add constraint properties_postal_code_check
  check (postal_code ~ '^[0-9]{8}$');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_property_number_key') then
    alter table public.properties add constraint properties_property_number_key unique (property_number);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_classification_check') then
    alter table public.properties add constraint properties_classification_check
      check (classification in ('residential', 'commercial'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_detailed_type_check') then
    alter table public.properties add constraint properties_detailed_type_check check (
      (classification = 'residential' and property_type in (
        'house', 'townhouse', 'semi_detached_house', 'apartment',
        'penthouse', 'studio', 'loft', 'undefined'
      ))
      or
      (classification = 'commercial' and property_type in (
        'commercial_room', 'store', 'commercial_house', 'commercial_building',
        'warehouse', 'storage', 'shopping_center', 'undefined'
      ))
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_registration_status_check') then
    alter table public.properties add constraint properties_registration_status_check
      check (status in ('active', 'inactive', 'archived'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_street_type_check') then
    alter table public.properties add constraint properties_street_type_check check (street_type in (
      'street', 'avenue', 'lane', 'alameda', 'square', 'road', 'highway',
      'alley', 'narrow_alley', 'largo', 'easement', 'passage', 'undefined'
    ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_address_lengths_check') then
    alter table public.properties add constraint properties_address_lengths_check check (
      char_length(name) between 1 and 250
      and char_length(address_line) <= 250
      and (complement is null or char_length(complement) <= 250)
      and (district is null or char_length(district) <= 250)
      and char_length(city) <= 250
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_state_check') then
    alter table public.properties add constraint properties_state_check check (state in (
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
      'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
    ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_number_check') then
    alter table public.properties add constraint properties_number_check check (
      (no_number = true and street_number is null)
      or (no_number = false and street_number is not null and street_number >= 0)
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_areas_check') then
    alter table public.properties add constraint properties_areas_check check (
      (unit_area is null or unit_area >= 0)
      and (land_area is null or land_area >= 0)
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_counts_check') then
    alter table public.properties add constraint properties_counts_check check (
      room_count between 0 and 99999
      and bedroom_count between 0 and 99999
      and bathroom_count between 0 and 99999
      and garage_space_count between 0 and 99999
      and pool_count between 0 and 99999
    );
  end if;
end;
$$;

create index if not exists properties_status_idx
  on public.properties (organization_id, status);
create index if not exists properties_city_state_idx
  on public.properties (organization_id, state, city);

create or replace function public.set_properties_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists properties_set_updated_at on public.properties;
drop trigger if exists properties_set_audit on public.properties;
create trigger properties_set_audit
before update on public.properties
for each row execute procedure public.set_properties_audit();

grant select, insert, update, delete on public.properties to authenticated;
grant usage, select on sequence public.properties_property_number_seq to authenticated;

comment on column public.properties.id is 'UUID interno usado nos relacionamentos do sistema.';
comment on column public.properties.property_number is 'ID numérico sequencial exibido ao usuário.';
comment on column public.properties.name is 'Título amigável usado para identificar o imóvel.';
comment on column public.properties.postal_code is 'CEP obrigatório com oito dígitos, armazenado como texto para preservar zeros iniciais.';
comment on column public.properties.created_at is 'Data e hora de criação geradas automaticamente.';

commit;

-- Validação opcional:
-- select property_number, name, classification, property_type, status, created_at
-- from public.properties order by property_number;

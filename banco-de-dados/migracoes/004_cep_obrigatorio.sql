-- Imobitec | Torna CEP obrigatório em imóveis já estruturados
-- Execute este arquivo no Supabase SQL Editor após 003_cadastro_imoveis.sql.

begin;

update public.properties
set postal_code = regexp_replace(postal_code, '[^0-9]', '', 'g')
where postal_code is not null;

do $$
declare
  invalid_count integer;
begin
  select count(*)
  into invalid_count
  from public.properties
  where postal_code is null or postal_code !~ '^[0-9]{8}$';

  if invalid_count > 0 then
    raise exception
      'Existem % imóvel(is) sem CEP válido. Corrija-os antes de aplicar esta regra.',
      invalid_count;
  end if;
end;
$$;

alter table public.properties
  alter column postal_code set not null,
  drop constraint if exists properties_postal_code_check;

alter table public.properties
  add constraint properties_postal_code_check
  check (postal_code ~ '^[0-9]{8}$');

comment on column public.properties.postal_code is
  'CEP obrigatório com oito dígitos, armazenado como texto para preservar zeros iniciais.';

commit;

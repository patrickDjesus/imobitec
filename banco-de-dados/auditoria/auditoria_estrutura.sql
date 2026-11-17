-- Imobitec | Auditoria de estrutura do banco
-- Consulta somente leitura: não cria, altera ou exclui objetos ou dados.
-- Escopo: objetos da aplicação no schema public e triggers que chamem
-- funções públicas, inclusive quando instalados sobre auth.users.

with
table_rows as (
  select
    n.nspname as schema_name,
    c.relname as object_name,
    case c.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned_table'
      when 'v' then 'view'
      when 'm' then 'materialized_view'
      when 'f' then 'foreign_table'
      else c.relkind::text
    end as object_type,
    pg_get_userbyid(c.relowner) as owner_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    obj_description(c.oid, 'pg_class') as object_comment
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
),
column_rows as (
  select
    cols.table_schema as schema_name,
    cols.table_name,
    cols.ordinal_position,
    cols.column_name,
    cols.data_type,
    cols.udt_schema,
    cols.udt_name,
    cols.is_nullable,
    cols.column_default,
    cols.character_maximum_length,
    cols.numeric_precision,
    cols.numeric_scale,
    cols.datetime_precision,
    cols.is_identity,
    cols.identity_generation,
    cols.is_generated,
    cols.generation_expression
  from information_schema.columns cols
  where cols.table_schema = 'public'
),
constraint_rows as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    con.conname as constraint_name,
    case con.contype
      when 'p' then 'primary_key'
      when 'f' then 'foreign_key'
      when 'u' then 'unique'
      when 'c' then 'check'
      when 'x' then 'exclusion'
      else con.contype::text
    end as constraint_type,
    pg_catalog.pg_get_constraintdef(con.oid, true) as definition,
    con.convalidated as is_validated,
    con.condeferrable as is_deferrable,
    con.condeferred as initially_deferred
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
index_rows as (
  select
    idx.schemaname as schema_name,
    idx.tablename as table_name,
    idx.indexname as index_name,
    idx.tablespace,
    idx.indexdef as definition
  from pg_catalog.pg_indexes idx
  where idx.schemaname = 'public'
),
policy_rows as (
  select
    pol.schemaname as schema_name,
    pol.tablename as table_name,
    pol.policyname as policy_name,
    pol.permissive,
    pol.roles,
    pol.cmd as command,
    pol.qual as using_expression,
    pol.with_check as check_expression
  from pg_catalog.pg_policies pol
  where pol.schemaname = 'public'
),
function_rows as (
  select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
    pg_catalog.pg_get_function_result(p.oid) as return_type,
    l.lanname as language_name,
    case p.prokind
      when 'f' then 'function'
      when 'p' then 'procedure'
      when 'a' then 'aggregate'
      when 'w' then 'window_function'
      else p.prokind::text
    end as routine_type,
    p.prosecdef as security_definer,
    case p.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      when 'v' then 'volatile'
      else p.provolatile::text
    end as volatility,
    p.proconfig as configuration,
    pg_catalog.pg_get_functiondef(p.oid) as definition
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
),
trigger_rows as (
  select
    table_ns.nspname as table_schema,
    table_class.relname as table_name,
    trg.tgname as trigger_name,
    function_ns.nspname as function_schema,
    function_proc.proname as function_name,
    case trg.tgenabled
      when 'O' then 'enabled_origin'
      when 'D' then 'disabled'
      when 'R' then 'enabled_replica'
      when 'A' then 'enabled_always'
      else trg.tgenabled::text
    end as enabled_state,
    pg_catalog.pg_get_triggerdef(trg.oid, true) as definition
  from pg_catalog.pg_trigger trg
  join pg_catalog.pg_class table_class on table_class.oid = trg.tgrelid
  join pg_catalog.pg_namespace table_ns on table_ns.oid = table_class.relnamespace
  join pg_catalog.pg_proc function_proc on function_proc.oid = trg.tgfoid
  join pg_catalog.pg_namespace function_ns on function_ns.oid = function_proc.pronamespace
  where not trg.tgisinternal
    and (
      table_ns.nspname = 'public'
      or function_ns.nspname = 'public'
    )
),
enum_rows as (
  select
    n.nspname as schema_name,
    t.typname as type_name,
    e.enumsortorder as sort_order,
    e.enumlabel as enum_value
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  join pg_catalog.pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
),
sequence_rows as (
  select
    seq.sequence_schema as schema_name,
    seq.sequence_name,
    seq.data_type,
    seq.start_value,
    seq.minimum_value,
    seq.maximum_value,
    seq.increment,
    seq.cycle_option
  from information_schema.sequences seq
  where seq.sequence_schema = 'public'
),
view_rows as (
  select
    views.schemaname as schema_name,
    views.viewname as view_name,
    views.viewowner as owner_name,
    views.definition
  from pg_catalog.pg_views views
  where views.schemaname = 'public'
),
grant_rows as (
  select
    grants.table_schema as schema_name,
    grants.table_name,
    grants.grantor,
    grants.grantee,
    grants.privilege_type,
    grants.is_grantable
  from information_schema.role_table_grants grants
  where grants.table_schema = 'public'
),
extension_rows as (
  select
    ext.extname as extension_name,
    ext.extversion as extension_version,
    ns.nspname as installed_schema
  from pg_catalog.pg_extension ext
  join pg_catalog.pg_namespace ns on ns.oid = ext.extnamespace
),
tables_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.object_name),
    '[]'::jsonb
  ) as value
  from table_rows row_data
),
columns_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.table_name, row_data.ordinal_position),
    '[]'::jsonb
  ) as value
  from column_rows row_data
),
constraints_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.table_name, row_data.constraint_name),
    '[]'::jsonb
  ) as value
  from constraint_rows row_data
),
indexes_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.table_name, row_data.index_name),
    '[]'::jsonb
  ) as value
  from index_rows row_data
),
policies_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.table_name, row_data.policy_name),
    '[]'::jsonb
  ) as value
  from policy_rows row_data
),
functions_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.function_name, row_data.arguments),
    '[]'::jsonb
  ) as value
  from function_rows row_data
),
triggers_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.table_schema, row_data.table_name, row_data.trigger_name),
    '[]'::jsonb
  ) as value
  from trigger_rows row_data
),
enums_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.type_name, row_data.sort_order),
    '[]'::jsonb
  ) as value
  from enum_rows row_data
),
sequences_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.sequence_name),
    '[]'::jsonb
  ) as value
  from sequence_rows row_data
),
views_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.view_name),
    '[]'::jsonb
  ) as value
  from view_rows row_data
),
grants_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.table_name, row_data.grantee, row_data.privilege_type),
    '[]'::jsonb
  ) as value
  from grant_rows row_data
),
extensions_json as (
  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.extension_name),
    '[]'::jsonb
  ) as value
  from extension_rows row_data
),
rls_without_policy_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema_name', row_data.schema_name,
        'table_name', row_data.object_name
      )
      order by row_data.schema_name, row_data.object_name
    ),
    '[]'::jsonb
  ) as value
  from table_rows row_data
  where row_data.object_type in ('table', 'partitioned_table')
    and row_data.rls_enabled
    and not exists (
      select 1
      from policy_rows policy
      where policy.schema_name = row_data.schema_name
        and policy.table_name = row_data.object_name
    )
),
tables_without_rls_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema_name', row_data.schema_name,
        'table_name', row_data.object_name
      )
      order by row_data.schema_name, row_data.object_name
    ),
    '[]'::jsonb
  ) as value
  from table_rows row_data
  where row_data.object_type in ('table', 'partitioned_table')
    and not row_data.rls_enabled
)
select jsonb_pretty(
  jsonb_build_object(
    'audit_name', 'Imobitec database structure audit',
    'audit_version', '1.0.0',
    'generated_at_utc', timezone('utc', statement_timestamp()),
    'database_name', current_database(),
    'postgres_version', current_setting('server_version'),
    'scope', jsonb_build_array(
      'public schema objects',
      'public RLS policies and grants',
      'non-internal triggers on public objects or calling public functions',
      'no application table data'
    ),
    'summary', jsonb_build_object(
      'objects', (select count(*) from table_rows),
      'columns', (select count(*) from column_rows),
      'constraints', (select count(*) from constraint_rows),
      'indexes', (select count(*) from index_rows),
      'policies', (select count(*) from policy_rows),
      'functions', (select count(*) from function_rows),
      'triggers', (select count(*) from trigger_rows),
      'enum_values', (select count(*) from enum_rows)
    ),
    'diagnostics', jsonb_build_object(
      'rls_enabled_without_policy', (select value from rls_without_policy_json),
      'tables_without_rls', (select value from tables_without_rls_json)
    ),
    'tables_and_views', (select value from tables_json),
    'columns', (select value from columns_json),
    'constraints', (select value from constraints_json),
    'indexes', (select value from indexes_json),
    'rls_policies', (select value from policies_json),
    'functions_and_procedures', (select value from functions_json),
    'triggers', (select value from triggers_json),
    'enum_values', (select value from enums_json),
    'sequences', (select value from sequences_json),
    'views', (select value from views_json),
    'table_grants', (select value from grants_json),
    'extensions', (select value from extensions_json)
  )
) as auditoria_imobitec;

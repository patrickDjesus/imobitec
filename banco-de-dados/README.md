# Banco de dados

Pasta `migracoes/` contém scripts incrementais do Supabase PostgreSQL.

Pasta `auditoria/` contém consulta somente leitura para comparar estrutura real do banco com migrações do projeto.

Execute arquivos em ordem numérica. Antes de nova alteração, crie próximo número; não altere migração já aplicada sem registrar motivo e impacto.

Exportação atual do esquema, quando fornecida, será comparada com essas migrações para localizar divergências, objetos obsoletos, políticas RLS incompletas e índices ausentes.

# Auditoria do banco

`auditoria_estrutura.sql` é consulta somente leitura. Não cria, altera ou exclui objetos e não exporta registros das tabelas da aplicação.

## Executar no Supabase

1. Abra **SQL Editor** no projeto.
2. Crie consulta com **New query**.
3. Copie conteúdo completo de `auditoria_estrutura.sql`.
4. Clique em **Run**.
5. Resultado terá uma linha e coluna chamada `auditoria_imobitec`.
6. Baixe resultado como CSV ou copie conteúdo JSON completo.
7. Salve em `banco-de-dados/exportacoes/` e anexe arquivo na conversa.

## Conteúdo do relatório

- tabelas, views, colunas e tipos;
- chaves, constraints e índices;
- políticas RLS e permissões;
- funções, procedures e triggers;
- enums, sequences e extensões;
- alertas para tabelas sem RLS ou com RLS sem política.

Relatório não contém linhas cadastradas, e-mails, senhas, tokens ou chaves da API.

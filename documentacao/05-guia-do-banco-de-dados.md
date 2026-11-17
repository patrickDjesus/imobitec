# Guia do banco de dados

## Migrações

Arquivos em `banco-de-dados/migracoes/` representam evolução incremental. Execute na ordem numérica, do `001` ao arquivo mais recente.

Não execute apenas último arquivo em banco vazio: migrações posteriores dependem das anteriores.

## Dados necessários para auditoria

Para validar estrutura real do Supabase, envie exportação somente do esquema, sem senhas, tokens ou chaves secretas. Formatos aceitos:

- arquivo `.sql` gerado pelo Supabase CLI ou `pg_dump --schema-only`;
- relatório com tabelas, colunas, tipos, PKs, FKs, índices, constraints, triggers, funções e políticas RLS;
- capturas do Database Schema Visualizer como apoio, nunca como única fonte.

Dados pessoais não são necessários. Caso queira validar conteúdo de teste, exporte poucas linhas anonimizadas em `.csv` por tabela.

## Segurança

Nunca envie:

- senha do banco;
- chave `service_role`;
- chave `sb_secret_...`;
- access token pessoal;
- dados reais de clientes ou imóveis.

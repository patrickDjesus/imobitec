# Estrutura do projeto

```text
A3/
├── banco-de-dados/
│   ├── auditoria/          consulta e orientações para auditoria do Supabase
│   └── migracoes/          SQL executado no Supabase, em ordem numérica
├── documentacao/           materiais acadêmicos e de QA
├── public/                 favicon e arquivos públicos
├── src/
│   ├── app/                páginas, estilos e rotas de API
│   ├── components/         telas, modais e componentes funcionais
│   └── lib/                regras de negócio e integrações
├── tests/                  testes automatizados
├── build/                  adaptação técnica para execução local
├── scripts/                comandos auxiliares de instalação e execução
├── .env.example            modelo de configuração pública
├── package.json            dependências e comandos
└── README.md               índice principal
```

## Critério de organização

- Código do produto fica em `src/`.
- Banco fica isolado do código e numerado por evolução.
- Documentos acadêmicos recebem prefixo numérico para leitura orientada.
- Testes ficam separados, mas espelham regras existentes em `src/lib/`.
- Arquivos de build gerados não são versionados.

## Arquivos locais não versionados

- `.env.local`: credenciais públicas do ambiente local.
- `node_modules/`: dependências instaladas pelo pnpm.
- `.next/`, `.vinext/`, `.wrangler/` e `dist/`: caches e artefatos regeneráveis.
- `.sites-runtime/`: seleção local do ambiente de execução.
- `*.tsbuildinfo`: cache incremental do TypeScript.

## Itens removidos

Starter continha componentes Shadcn, exemplo D1/Drizzle, autenticação ChatGPT,
conectores e ícones padrão não usados pelo Imobitec. Também foram removidas APIs
simuladas de painel e vistoria, substituídas pelo acesso real ao Supabase.
Referências foram verificadas antes da remoção. Histórico permanece recuperável
no Git local.

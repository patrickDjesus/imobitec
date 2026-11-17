# Plano de testes

## Objetivo

Validar autenticação, cadastros, regras de vistoria, geração de não conformidades e integridade dos fluxos críticos.

## Casos funcionais

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-01 | Entrar com credenciais válidas | Abrir dashboard sem expor e-mail na interface |
| CT-02 | Alternar entre login e cadastro | Limpar campos preenchidos |
| CT-03 | Cadastrar imóvel válido | Persistir registro com CEP e campos obrigatórios |
| CT-04 | Consultar CEP | Preencher dados encontrados e permitir complemento manual |
| CT-05 | Editar e excluir imóvel | Refletir alteração no sistema e banco |
| CT-06 | Criar vistoria | Vincular imóvel, responsável, data, horário e ambientes |
| CT-07 | Exceder quantidade de cômodos | Bloquear cadastro inválido |
| CT-08 | Criar checklist duplicado | Bloquear segundo modelo para mesmo ambiente |
| CT-09 | Concluir vistoria | Registrar resultado individual de todos os itens |
| CT-10 | Marcar atenção ou não conforme | Criar pendência na aba Não conformidades |
| CT-11 | Iniciar e enviar correção | Atualizar situação da pendência |
| CT-12 | Validar correção com outro usuário | Bloquear ação |
| CT-13 | Validar correção como responsável | Concluir validação |
| CT-14 | Imprimir ficha de imóvel | Gerar conteúdo específico sem página vazia adicional |
| CT-15 | Imprimir ficha de vistoria | Incluir ambientes e checklists selecionados |
| CT-16 | Atualizar cadastros | Recalcular indicadores do dashboard |

## Testes não funcionais

- **Segurança:** validar sessão, RLS, permissões e mensagens sem detalhes internos.
- **Usabilidade:** ações principais visíveis e feedback após alterações.
- **Responsividade:** verificar 375 px, 768 px e 1366 px.
- **Acessibilidade:** teclado, foco visível, rótulos e contraste.
- **Confiabilidade:** regras críticas cobertas por testes automatizados.
- **Compatibilidade:** versões atuais de Chrome, Edge e Firefox.

## Critério de aceite

Testes automatizados, checagem TypeScript e build devem passar. Casos críticos CT-01, CT-03, CT-06, CT-08, CT-09, CT-10, CT-12 e CT-13 não podem falhar.

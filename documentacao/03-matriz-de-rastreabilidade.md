# Matriz de rastreabilidade

| Requisito | Implementação principal | Verificação |
|---|---|---|
| RF-01 Autenticar usuários | `src/app/page.tsx`, `src/lib/auth.ts` | CT-01, CT-02 e `tests/auth.test.ts` |
| RF-02 Gerenciar imóveis | `src/components/property-*` | CT-03 a CT-05 e `tests/property.test.ts` |
| RF-03 Consultar endereços | `src/app/api/address`, `src/lib/address.ts` | CT-04 e `tests/address.test.ts` |
| RF-04 Gerenciar vistorias | `src/components/inspection-*` | CT-06, CT-07 e `tests/inspection.test.ts` |
| RF-05 Gerenciar checklists | `src/components/checklist-*` | CT-08 e `tests/checklist-template.test.ts` |
| RF-06 Concluir vistoria | `inspection-completion-modal.tsx` | CT-09 |
| RF-07 Gerar não conformidades | `src/lib/nonconformity.ts` | CT-10 e `tests/nonconformity.test.ts` |
| RF-08 Controlar correção e validação | `nonconformities-view.tsx` | CT-11 a CT-13 |
| RF-09 Imprimir fichas | Modais de detalhes e CSS de impressão | CT-14, CT-15 |
| RF-10 Atualizar dashboard | `dashboard-view.tsx`, `src/lib/dashboard.ts` | CT-16 |
| RNF-01 Proteger dados | Supabase Auth e políticas RLS | Revisão SQL e CT-01, CT-12 |
| RNF-02 Validar regras | Funções em `src/lib/` | Testes automatizados |
| RNF-03 Manter rastreabilidade | IDs, FKs e histórico SQL | Revisão do banco |

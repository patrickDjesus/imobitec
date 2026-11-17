# Visão geral

## Problema

Vistorias imobiliárias dependem de cadastros consistentes, checklists adequados ao ambiente e acompanhamento das irregularidades encontradas. Registros dispersos dificultam rastreabilidade, comparação e validação das correções.

## Solução proposta

Imobitec centraliza imóveis, vistorias, ambientes, itens inspecionados e não conformidades. Cada vistoria fica vinculada a imóvel e responsável. Ao concluir, itens classificados como atenção ou não conforme geram pendências acompanháveis.

## Diferencial

Sistema não encerra trabalho na emissão da ficha. Não conformidades seguem fluxo de correção e validação, mantendo vínculo com vistoria, imóvel, item e responsável original.

## Arquitetura

- **Frontend:** React, Next.js e TypeScript.
- **Backend e autenticação:** Supabase Auth, PostgreSQL e RLS.
- **Integração de endereço:** API interna com provedores públicos de CEP e localidades.
- **Qualidade:** testes unitários, plano de testes e matriz de rastreabilidade.
- **Execução local:** Vinext, Vite e Wrangler.

## Escopo atual

Protótipo funcional para uma única imobiliária. Usuários autenticados compartilham registros permitidos pelas políticas do banco. Controle avançado de organizações, cobrança, assinatura eletrônica e armazenamento de fotos ficam fora desta etapa.

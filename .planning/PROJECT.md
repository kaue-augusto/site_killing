# Kisabot

## What This Is

Kisabot é uma plataforma de atendimento via WhatsApp com agentes de IA, projetada para responder clientes externos (clientes/parceiros) e colaboradores internos de empresas. Os agentes são orquestrados pelo n8n (self-hosted), usam Google Vertex AI (Gemini) como modelo principal, consultam PDFs no Google Cloud Storage, fazem WebScraping via Firecrawl e registram todo o histórico no Supabase. Um painel React permite que atendentes e gestores monitorem conversas, intervenham quando necessário e acompanhem métricas.

## Core Value

Atender o máximo de clientes simultaneamente via WhatsApp com IA estável — sem paradas, sem intervenção manual, com histórico completo disponível no painel.

## Requirements

### Validated

- ✓ Receber mensagens via WhatsApp (webhook Z-API → n8n) — existente
- ✓ Responder com IA via Vertex AI (Gemini) como modelo corpo — existente
- ✓ Registrar chats e mensagens no Supabase (tabelas `chats`, `messages`) — existente
- ✓ Consultar PDFs no Google Cloud Storage — existente
- ✓ WebScraping via Firecrawl para consulta ao site da empresa — existente
- ✓ Painel React com lista de conversas, chat e painel de contato — existente
- ✓ Dashboard com métricas de atendimento — existente (dados parcialmente mockados)
- ✓ RBAC: roles admin / supervisor / atendente / visualizador — existente
- ✓ Upload de PDFs para treinamento do bot via GCP Edge Function — existente
- ✓ Multi-bot: seletor de bot por usuário com preferência persistida — existente

### Active

- [ ] **Performance React**: Migrar fetch de conversas/mensagens para React Query (`useQuery`/`useMutation`); eliminar re-renders desnecessários
- [ ] **Reconexão automática GCP**: Detectar falha de credenciais GCP no n8n e reconectar sem intervenção manual
- [ ] **Escala n8n**: Suportar 50–200 conversas simultâneas sem degradação; adicionar filas ou worker paralelos se necessário
- [ ] **Monitoramento**: Alertas automáticos (Slack/email/webhook) quando credenciais caírem ou latência ultrapassar threshold
- [ ] **TTS — Envio de áudio**: Agente responde com mensagem de voz via WhatsApp (Google Cloud TTS recomendado, já no stack GCP)
- [ ] **Leitura de imagem**: Agente processa imagens enviadas pelo usuário via Gemini Vision (já disponível no Vertex AI)
- [ ] **Agente interno (colaboradores)**: Fluxo n8n dedicado para atendimento de dúvidas de colaboradores, com base de conhecimento separada
- [ ] **Corrigir bugs críticos**: Dual Supabase client, token Z-API exposto no bundle, autoTransfer não persistido, instrucoesFinais descartadas
- [ ] **Métricas reais no Dashboard**: Substituir SLA e tempo médio de resposta hardcodados por dados reais do Supabase
- [ ] **reportContact funcional**: Gravar denúncias de contato no banco (hoje é stub)

### Out of Scope

- App mobile nativo — painel web responsivo é suficiente para os atendentes
- Suporte a outros canais além do WhatsApp (Telegram, Instagram) — fora do escopo desta milestone
- Troca de provedor de IA (permanece Vertex AI/Gemini) — decisão técnica consolidada
- Redux/Zustand — React Query + Context já é suficiente para o volume de estado

## Context

**Stack existente:**
- Frontend: React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase Realtime
- Backend: Supabase (Auth, DB, Realtime, Edge Functions em Deno)
- Orquestração IA: n8n self-hosted com LangChain Agent node
- IA: Google Vertex AI (Gemini) via n8n
- WhatsApp: Z-API (instâncias por bot)
- Armazenamento de arquivos: Google Cloud Storage
- WebScraping: Firecrawl
- Edge Functions: `upload-gcp-pdf`, `generate-signed-url`

**Problemas conhecidos no código atual (codebase map):**
- Dois clientes Supabase separados (`src/integrations/supabase/client.ts` e `src/lib/supabase.ts`) causando inconsistência de sessão e canais Realtime duplicados
- Token Z-API hardcodado no bundle JS do cliente (risco de segurança)
- React Query instalado mas não usado — todas as páginas gerenciam estado com `useState`/`useEffect` manualmente
- Dashboard com métricas e SLA completamente mockados (dados falsos)
- `autoTransfer` e `instrucoesFinais` calculados mas nunca salvos
- `reportContact` é stub — não grava nada no banco
- Credenciais GCP caem de forma imprevisível no n8n, exigindo reconexão manual

**Fluxo n8n atual:**
- Arquivo: `WhatsApp - GCP_completo.json`
- Webhook → validação → busca contexto no Supabase → AI Agent (Vertex/Gemini) → tools (Consultar_Site, LerArquivoPDF, VerificarMatricula, BuscarEndereco) → Z-API send-text
- Processa texto, áudio transcrito e imagens analisadas (já parcialmente implementado)
- Leitura de áudio e imagem existe no fluxo, mas TTS (resposta em áudio) ainda não implementado

## Constraints

- **Stack**: Manter Vertex AI (Gemini) como modelo principal — decisão consolidada pela empresa
- **Infra**: n8n self-hosted — não migrar para n8n Cloud
- **Segurança**: Token Z-API deve sair do bundle do cliente antes de ir para produção nova
- **Compatibilidade**: Não quebrar fluxos de atendimento já em produção durante melhorias
- **Banco**: Supabase como fonte única de verdade para chats, messages, bots, contacts
- **Volume**: Projetar para 50–200 conversas simultâneas no pico

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google Cloud TTS para envio de áudio | Já usa GCP; evita novo fornecedor e credenciais extras | — Pending |
| Vertex AI (Gemini) para leitura de imagem | Já é o modelo principal; suporte nativo a visão multimodal | — Pending |
| Fluxo n8n separado para colaboradores | Isola base de conhecimento e evita vazamento de info interna para clientes | — Pending |
| React Query para fetch de dados | Elimina useState/useEffect manual; caching, deduplication, background refetch | — Pending |
| Consolidar para um único cliente Supabase | Evitar inconsistência de sessão e canais Realtime duplicados | — Pending |

## Evolution

Este documento evolui a cada transição de fase e milestone.

**Após cada fase** (`/gsd-transition`):
1. Requirements invalidados? → Mover para Out of Scope com motivo
2. Requirements validados? → Mover para Validated com referência da fase
3. Novos requirements emergiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda preciso? → Atualizar se derivou

**Após cada milestone** (`/gsd-complete-milestone`):
1. Revisão completa de todas as seções
2. Core Value check — ainda é a prioridade certa?
3. Auditoria do Out of Scope — motivos ainda válidos?
4. Atualizar Context com estado atual

---
*Last updated: 2026-04-29 after initialization*

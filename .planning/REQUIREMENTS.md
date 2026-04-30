# Requirements: Kisabot

**Defined:** 2026-04-30
**Core Value:** Atender o máximo de clientes simultaneamente via WhatsApp com IA estável — sem paradas, sem intervenção manual, com histórico completo disponível no painel.

## v1 Requirements

### Security

- [ ] **SEC-01**: Token Z-API (`Client-Token`) removido do bundle JS do cliente e movido para Supabase Edge Function `send-whatsapp`
- [ ] **SEC-02**: Todas as chamadas Z-API (envio de mensagens, áudio, status) passam pela Edge Function, não pelo cliente React
- [ ] **SEC-03**: Variáveis de ambiente sensíveis (Z-API token, GCP credentials) nunca aparecem em código commitado ou no bundle

### Infrastructure (Supabase)

- [ ] **INFRA-01**: Codebase usa um único cliente Supabase (`src/integrations/supabase/client.ts`) — `src/lib/supabase.ts` removido e todos os imports atualizados
- [ ] **INFRA-02**: Subscriptions Realtime em `Atendimentos.tsx` filtradas por `bot_id` do bot selecionado (elimina eventos de outros bots)
- [ ] **INFRA-03**: React Query (`useQuery`/`useMutation`) usado para todas as operações de fetch/mutação em `Atendimentos.tsx` e `Dashboard.tsx`

### Infrastructure (n8n)

- [ ] **N8N-01**: n8n self-hosted configurado em Queue Mode com Redis como broker de filas
- [ ] **N8N-02**: Pelo menos 2 worker processes separados do processo main para execução paralela de workflows
- [ ] **N8N-03**: Variável `N8N_ENCRYPTION_KEY` idêntica em todos os processos (main + workers) para descriptografar credenciais
- [ ] **N8N-04**: Retry automático configurado nos nós críticos do fluxo (Vertex AI, Supabase, Z-API) com backoff exponencial

### GCP Credentials

- [ ] **GCP-01**: Credenciais GCP no n8n migradas de OAuth2 para Service Account JSON (sem expiração de 7 dias)
- [ ] **GCP-02**: Fluxo n8n executa sem intervenção manual de reconexão por pelo menos 30 dias consecutivos
- [ ] **GCP-03**: Alerta automático (webhook Slack ou email) disparado quando credencial GCP falhar ou workflow n8n terminar com erro

### Monitoring

- [ ] **MON-01**: Health check externo monitorando endpoint `/healthz/readiness` do n8n com alerta em caso de falha
- [ ] **MON-02**: n8n Error Trigger node configurado no fluxo principal para enviar notificação (Slack/email/webhook) em caso de falha de execução
- [ ] **MON-03**: Alerta configurado quando latência média de resposta ultrapassar threshold definido (ex: >30s por conversa)

### Bug Fixes

- [ ] **BUG-01**: `autoTransfer` persiste corretamente — salvo em `saveBotTraining` e na coluna `bots.auto_transfer` no Supabase
- [ ] **BUG-02**: `instrucoesFinais` (com identidade do bot apendada) é o valor salvo em `saveBotTraining`, não `instructions` sem identidade
- [ ] **BUG-03**: `fetchContacts` não retorna `mockContacts` em caso de erro — retorna array vazio com toast de erro visível
- [ ] **BUG-04**: `handleGenerateQR` não dispara duas chamadas Z-API sequenciais — chamada duplicada removida

### AI Features — Image

- [ ] **IMG-01**: Agente n8n processa imagens enviadas pelo usuário via Gemini Vision (Vertex AI multimodal) e inclui análise no contexto do AI Agent
- [ ] **IMG-02**: Pipeline completo: Z-API recebe imagem → n8n baixa/extrai → Gemini Vision analisa → resultado injetado como mensagem no contexto do agente
- [ ] **IMG-03**: Mensagens com imagem aparecem corretamente no painel React (thumbnail ou indicador de imagem no ChatWindow)

### AI Features — Audio (TTS)

- [ ] **TTS-01**: Agente n8n pode responder com mensagem de voz via WhatsApp (PTT — Push to Talk)
- [ ] **TTS-02**: Google Cloud TTS gera áudio em formato OGG Opus (48kHz mono) — formato nativo do WhatsApp para voice notes
- [ ] **TTS-03**: Fluxo n8n decide quando responder em áudio vs texto com base em critério configurável (ex: flag no prompt do bot ou palavra-chave na mensagem)
- [ ] **TTS-04**: Arquivo de áudio gerado é enviado via Z-API `/send-audio` com flag PTT ativo
- [ ] **TTS-05**: Sandbox test confirma que Z-API da instância atual suporta PTT flag antes do rollout

---

## v2 Requirements

### Dashboard com Métricas Reais

- **DASH-01**: Tabela `messages` tem coluna `first_response_at` para calcular SLA real
- **DASH-02**: Dashboard calcula tempo médio de resposta real a partir de timestamps do Supabase
- **DASH-03**: Gráfico SLA semanal calculado de dados reais (não hardcodado)
- **DASH-04**: KPI "Tempo médio de resposta" calculado em tempo real (não fixo em '1m 20s')

### Agente Interno (Colaboradores)

- **INT-01**: Fluxo n8n separado para atendimento de colaboradores com base de conhecimento exclusiva (sem acesso à base de clientes)
- **INT-02**: GCS bucket separado para documentos internos
- **INT-03**: Instância Z-API separada para o número de WhatsApp interno
- **INT-04**: Bots internos visíveis apenas para roles admin/supervisor no painel

### reportContact

- **REP-01**: `reportContact` grava registro em tabela `contact_reports` no Supabase (não é mais stub)
- **REP-02**: Admin pode visualizar denúncias na página de Configurações

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| App mobile nativo | Painel web responsivo é suficiente; complexidade não justifica |
| Outros canais (Telegram, Instagram) | Fora do foco WhatsApp desta milestone |
| Fine-tuning do modelo Vertex AI | RAG via PDFs + Firecrawl é suficiente; ops overhead alto |
| Campanhas outbound proativas | Requer template approval do WhatsApp; fora do escopo atual |
| Redux / Zustand | React Query + Context cobre o volume de estado necessário |
| Memória persistente entre sessões / user profiling | Complexidade alta, baixo retorno imediato |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 2 | Pending |
| INFRA-03 | Phase 2 | Pending |
| N8N-01 | Phase 3 | Pending |
| N8N-02 | Phase 3 | Pending |
| N8N-03 | Phase 3 | Pending |
| N8N-04 | Phase 3 | Pending |
| GCP-01 | Phase 3 | Pending |
| GCP-02 | Phase 3 | Pending |
| GCP-03 | Phase 3 | Pending |
| MON-01 | Phase 3 | Pending |
| MON-02 | Phase 3 | Pending |
| MON-03 | Phase 3 | Pending |
| BUG-01 | Phase 2 | Pending |
| BUG-02 | Phase 2 | Pending |
| BUG-03 | Phase 2 | Pending |
| BUG-04 | Phase 2 | Pending |
| IMG-01 | Phase 4 | Pending |
| IMG-02 | Phase 4 | Pending |
| IMG-03 | Phase 4 | Pending |
| TTS-01 | Phase 4 | Pending |
| TTS-02 | Phase 4 | Pending |
| TTS-03 | Phase 4 | Pending |
| TTS-04 | Phase 4 | Pending |
| TTS-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-30*
*Last updated: 2026-04-30 after initial definition*

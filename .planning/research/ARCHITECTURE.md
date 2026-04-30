# Architecture Patterns

**Domain:** WhatsApp AI Customer Service Platform (n8n + Supabase + React SPA)
**Project:** Kisabot
**Researched:** 2026-04-29
**Confidence:** HIGH (all major claims backed by official documentation)

---

## Recommended Architecture

The target architecture separates concerns across four execution planes: browser client, Supabase (auth + DB + realtime + edge), n8n (orchestration in queue mode), and external providers (Z-API, Vertex AI, GCP).

```
Browser (React SPA)
  └── Supabase JS SDK (single instance)
        ├── Auth / RLS
        ├── DB queries (via React Query hooks)
        ├── Realtime channels (filtered per bot + chat)
        └── Edge Functions (proxy for secrets)
              ├── send-whatsapp  ← replaces client-side Z-API calls
              ├── upload-gcp-pdf (exists)
              └── generate-signed-url (exists)

n8n (queue mode)
  ├── Main process  — UI, webhook receiver, scheduler
  ├── Worker pool   — executes AI agent workflows (2–4 workers, concurrency 10 each)
  ├── Redis (BullMQ) — job queue + ephemeral locks
  └── PostgreSQL    — shared credentials, execution history

External
  ├── Z-API         — WhatsApp send/receive per bot instance
  ├── Vertex AI     — Gemini (text + vision + TTS)
  ├── GCP Storage   — PDF knowledge base
  └── Firecrawl     — web scraping tool
```

---

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| React SPA | Operator inbox, supervision, config, metrics display | Supabase (DB + Realtime + Edge), n8n (passive — reads DB written by n8n) |
| AuthContext | Session singleton, RBAC, bot access guard | Supabase Auth |
| BotContext | Active bot list, selected bot preference | Supabase DB (profiles table) |
| React Query hooks | Cache, loading state, deduplication, background refetch | api.ts functions |
| Supabase Realtime | Push new messages to open chat windows; update sidebar | Supabase Postgres CDC |
| Edge Function: send-whatsapp | Proxy Z-API calls server-side — holds Client-Token secret | Z-API REST API |
| Edge Function: upload-gcp-pdf | GCP upload proxy — holds GCP_CREDENTIALS secret (existing) | GCP Storage |
| n8n Main | Receive Z-API webhooks, trigger workflow execution via queue | Redis, PostgreSQL, Workers |
| n8n Worker(s) | Execute AI agent workflows: LangChain Agent, Vertex AI, tools | PostgreSQL, Redis, Z-API, GCP, Firecrawl, Supabase |
| Redis | BullMQ job queue between Main and Workers | n8n Main, n8n Workers |
| PostgreSQL | n8n workflow store, credentials, execution log | n8n Main, n8n Workers |
| Supabase DB | Source of truth for chats, messages, bots, contacts, metrics | SPA, n8n Workers, Edge Functions |

---

## n8n Queue Mode for High Concurrency

### Why Queue Mode

The current single-process n8n handles webhooks and workflow execution in one event loop. At 50–200 concurrent WhatsApp conversations, each requiring a round-trip to Vertex AI (latency 1–5 s), the event loop saturates and incoming webhooks queue behind running executions. Queue mode separates these concerns.

### Architecture in Queue Mode

```
Z-API Webhook POST
       |
   n8n Main process (webhook receiver only)
       | pushes job to Redis (BullMQ)
       |
     Redis
       | job picked up by next available worker
       |
   n8n Worker (1-N instances)
       | runs AI agent workflow
       | writes result to Supabase messages table
       | calls Z-API send-text
```

### Required Components

| Component | Role | Notes |
|-----------|------|-------|
| n8n Main | Webhook ingestion, UI, scheduler | `EXECUTIONS_MODE=queue` |
| n8n Worker(s) | Workflow execution | Same `N8N_ENCRYPTION_KEY` as Main |
| Redis | BullMQ job broker | Ephemeral — no execution data stored here |
| PostgreSQL | Shared n8n DB | Required; SQLite not supported in queue mode |

### Environment Variables (must be identical on Main and all Workers)

```
EXECUTIONS_MODE=queue
N8N_ENCRYPTION_KEY=<shared-secret>  # byte-identical across all instances
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=...
QUEUE_BULL_REDIS_HOST=...
QUEUE_BULL_REDIS_PORT=6379
QUEUE_HEALTH_CHECK_ACTIVE=true
N8N_METRICS=true
```

### Concurrency Sizing for Kisabot

Kisabot workflows are I/O-heavy (Vertex AI API calls, Supabase queries, Z-API calls) with minimal CPU work. Recommended formula: `workers x concurrency >= 2x expected peak concurrent executions`.

| Target peak | Workers | Concurrency/worker | Total capacity |
|-------------|---------|-------------------|----------------|
| 50 concurrent | 1 | 15 | 15 (add worker if needed) |
| 100 concurrent | 2 | 15 | 30 (scale to 4 workers at peak) |
| 200 concurrent | 4 | 15 | 60 (n8n recommended minimum: 5 per worker) |

Start with 2 workers at concurrency 15. Add workers horizontally as load increases. Do NOT set concurrency below 5 — many small workers exhaust the PostgreSQL connection pool.

### Confidence: HIGH
Source: [n8n Queue Mode Docs](https://docs.n8n.io/hosting/scaling/queue-mode/), [n8n Concurrency Docs](https://docs.n8n.io/hosting/scaling/concurrency-control/), [Elest.io queue mode guide](https://blog.elest.io/how-to-scale-n8n-with-redis-queue-mode-for-parallel-workflow-execution/)

---

## React Query + Supabase Realtime Pattern for Chat

### Problem with Current Approach

`Atendimentos.tsx` manages all state with `useState` + `useEffect`, creating:
- No caching (re-fetches entire conversation list on every bot switch)
- Manual deduplication of realtime events
- Channel recreation on every object-reference change (even same chat ID)
- Global `atualiza-sidebar` channel with no `bot_id` filter — all message inserts push to all clients

### Recommended Hybrid Pattern

Use React Query as the primary state layer. Use Supabase Realtime only to trigger `invalidateQueries` or append to the local cache — never as the sole state source.

```typescript
// 1. Fetch with React Query (caching + background refetch)
const { data: conversations } = useQuery({
  queryKey: ['conversations', selectedBot?.id],
  queryFn: () => fetchConversations(selectedBot.slug),
  staleTime: 30_000,
});

// 2. Subscribe to Realtime — trigger cache update only
useEffect(() => {
  if (!selectedBot?.id) return;

  const channel = supabase
    .channel(`sidebar-bot-${selectedBot.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `bot_id=eq.${selectedBot.id}`,  // <-- CRITICAL: filter by bot
    }, () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', selectedBot.id] });
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [selectedBot?.id]);  // <-- use .id not the full object

// 3. Active chat messages — append optimistically, sync via realtime
const { data: messages } = useQuery({
  queryKey: ['messages', conversationId],
  queryFn: () => fetchMessages(conversationId),
  enabled: !!conversationId,
});

useEffect(() => {
  if (!conversationId) return;

  const channel = supabase
    .channel(`chat-${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${conversationId}`,
    }, (payload) => {
      queryClient.setQueryData(['messages', conversationId], (old: Message[]) =>
        old.some(m => m.id === payload.new.id) ? old : [...old, payload.new as Message]
      );
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [conversationId]);
```

### Key Rules

| Rule | Rationale |
|------|-----------|
| Always filter Realtime channels by `bot_id` or `chat_id` | Unfiltered global subscriptions push every insert to every client — catastrophic at scale |
| Use `selectedConversation.id` (not object) as `useEffect` dependency | Prevents channel recreation when the object reference changes but ID is the same |
| Do not use Realtime as the sole source of messages | Realtime is best-effort; React Query fetch provides the authoritative initial state and handles reconnect |
| Invalidate or append — never replace full list from realtime | Replace-on-event loses optimistic updates and causes flickers |

### Confidence: HIGH
Source: [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime), [TanStack Query + Supabase pattern — Makerkit](https://makerkit.dev/blog/saas/supabase-react-query), [Supabase Discussion #5048](https://github.com/orgs/supabase/discussions/5048)

---

## Moving Credentials to Server-Side (Edge Functions)

### Current Exposure

Z-API `Client-Token` is hardcoded in `src/lib/api.ts` and shipped in the browser bundle. Any user who opens DevTools can extract it and make Z-API calls billed to the account.

### Target: Proxy Pattern via Edge Function

```
Browser
  └── supabase.functions.invoke('send-whatsapp', { body: { chatId, text, type } })
        |  JWT verified by Supabase
        |
    Edge Function: send-whatsapp (Deno, server-side)
        |  reads ZAPI_CLIENT_TOKEN from Supabase Secrets (env var)
        |  reads instance/token from bots table (DB query with RLS)
        └── POST https://api.z-api.io/instances/{id}/token/{token}/send-text
```

### Implementation Steps

1. Create `supabase/functions/send-whatsapp/index.ts`
2. Store `ZAPI_CLIENT_TOKEN` via `supabase secrets set ZAPI_CLIENT_TOKEN=...`
3. Read secret in function: `const token = Deno.env.get('ZAPI_CLIENT_TOKEN')`
4. Validate JWT in function header (Supabase default behavior when `verify_jwt=true`)
5. Replace all `fetch('https://api.z-api.io/...')` calls in `api.ts` with `supabase.functions.invoke('send-whatsapp', ...)`
6. Remove hardcoded token from `api.ts`
7. Rotate the exposed token in Z-API dashboard

### GCP Credentials (n8n)

GCP credentials that fall in n8n require a different approach — they live in n8n's credential store (PostgreSQL), not in the browser. The fix is:

1. Store GCP JSON key in n8n credentials with the correct credential type (`Google Service Account`)
2. Add an Error Workflow in n8n that catches `GOOGLE_AUTH_ERROR` or equivalent and sends a Slack/webhook alert
3. Add a periodic health-check workflow (cron every 5 min) that pings the GCP Storage API with the stored credential and alerts on failure
4. Do NOT store GCP credentials in the browser bundle — they must never leave n8n's server

### Confidence: HIGH
Source: [Supabase Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets), [Supabase Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)

---

## Retry and Circuit Breaker Patterns for n8n

### Error Classification

Before implementing retry, classify errors:

| Error Type | HTTP Codes | Action |
|------------|-----------|--------|
| Transient network | Timeout, 5xx | Retry with exponential backoff |
| Auth failure | 401, 403 | Alert + halt (no retry — will keep failing) |
| Rate limit | 429 | Retry after `Retry-After` header delay |
| Client error | 400, 422 | Dead-letter queue + human review |
| Business logic | n8n internal | Log + continue or alert |

### Retry Strategy in n8n

n8n's HTTP Request node has a built-in "Retry on Fail" toggle. For production use, combine with a loop for custom backoff:

```
HTTP Request (Vertex AI / Z-API)
  → On Error: route to Retry Logic
    → Wait node (exponential: 1s, 2s, 5s, 13s with ±20% jitter)
    → Increment attempt counter (Set node)
    → If attempts < 3: loop back to HTTP Request
    → If attempts >= 3: route to Error Handler
      → Insert to dead_letter_queue table (Supabase)
      → Send Slack/webhook alert
```

### Circuit Breaker in n8n

Implement via a `api_circuit_breakers` table in Supabase with columns: `api_name`, `state` (closed/open/half-open), `failure_count`, `last_failure_at`, `cooldown_until`.

```
[Before any critical HTTP Request]
  → Supabase Query: SELECT state FROM api_circuit_breakers WHERE api_name='vertex_ai'
  → If state='open' AND now() < cooldown_until:
      → Skip HTTP call → return cached/fallback response → notify operator
  → If state='open' AND now() >= cooldown_until:
      → Set state='half-open'
      → Allow one test request through
  → If state='closed' or 'half-open':
      → Execute HTTP Request
      → On success: reset failure_count=0, state='closed'
      → On failure: increment failure_count
        → If failure_count >= 5: set state='open', cooldown_until = now() + 5min
```

### GCP Credential Auto-Reconnect

The existing problem: GCP credentials in n8n expire or get invalidated without notification, causing silent AI failures. Solution:

1. Add Error Workflow (n8n setting: "Workflow → Settings → Error Workflow") pointing to a monitoring workflow
2. The monitoring workflow checks if the error is `UNAUTHENTICATED` or `401`
3. On auth error: send alert to Slack/webhook with instructions to refresh credential; do NOT auto-retry blindly (OAuth token refresh requires human reauth for Service Account key changes)
4. For OAuth2 credentials: n8n handles token refresh automatically if credential type is configured correctly — verify the GCP credential type in n8n is `Google Service Account` or `Google OAuth2`, not a generic HTTP credential with a pasted token

### Confidence: MEDIUM
Source: [n8n Error Handling Docs](https://docs.n8n.io/flow-logic/error-handling/), [PageLines n8n circuit breaker pattern](https://www.pagelines.com/blog/n8n-error-handling-patterns), [Wednesday.is advanced n8n error handling](https://www.wednesday.is/writing-articles/advanced-n8n-error-handling-and-recovery-strategies), [serenichron API integration patterns](https://serenichron.com/articles/api-integration-patterns-business-automation-n8n/)

---

## Anti-Patterns to Avoid

### Global Unfiltered Realtime Subscription

**What happens:** `atualiza-sidebar` channel subscribes to ALL `messages` INSERTs with no filter
**Why bad:** At 50 connected operators and 10 messages/second, each client receives 10 events/second regardless of which bot is active. Supabase Realtime has per-project event-rate limits. This causes unnecessary network traffic, client CPU load, and costs.
**Instead:** Filter by `bot_id=eq.${selectedBot.id}` at the channel level

### Dual Supabase Client Instances

**What happens:** Two `createClient` calls produce two independent auth/Realtime contexts
**Why bad:** Realtime channels opened on the secondary client are not tracked by the primary auth session; they either fail silently or leak open connections on logout
**Instead:** Single exported singleton from `src/integrations/supabase/client.ts`; delete `src/lib/supabase.ts`

### Z-API Calls from the Browser

**What happens:** `api.ts` calls `https://api.z-api.io/...` directly with a hardcoded `Client-Token`
**Why bad:** Token is visible in DevTools Network tab and in the compiled JS bundle; anyone can send messages from the company's WhatsApp number
**Instead:** Supabase Edge Function `send-whatsapp` as proxy; token stored in Supabase Secrets

### Single n8n Process for Webhook + Execution

**What happens:** The same n8n process that receives Z-API webhooks also runs 60-second AI agent workflows
**Why bad:** A spike of incoming messages blocks the webhook receiver behind running workflows; Z-API webhook retries pile up; eventual timeout causes duplicate messages
**Instead:** Queue mode separates webhook ingestion from execution; Main process is always free to receive webhooks

### `fetchConversations` Loading All Messages

**What happens:** All messages for all chats fetched in one query to find `lastMessage` per chat
**Why bad:** 500 chats x 200 messages = 100,000 rows transferred, processed client-side
**Instead:** `DISTINCT ON (chat_id) ORDER BY created_at DESC` query in PostgreSQL, or denormalized `last_message_at` + `last_message_content` columns on `chats` updated by a DB trigger

---

## Data Flow: Target State

### Incoming WhatsApp Message (n8n path)

```
1. Customer sends WhatsApp message
2. Z-API delivers webhook POST to n8n Main (queue mode)
3. n8n Main pushes job to Redis queue (< 5 ms)
4. n8n Worker picks up job from Redis
5. Worker queries Supabase: fetch chat context, history
6. Worker calls Vertex AI (Gemini) with LangChain Agent
7. Agent calls tools: Consultar_Site, LerArquivoPDF, etc.
8. Agent produces response text
9. Worker calls Z-API send-text (or via Edge Function)
10. Worker writes message to Supabase messages table
11. Supabase Postgres CDC fires → Realtime event to browser
12. Browser React Query cache updated → UI shows new message
```

### Agent → Human Handoff

```
1. AI agent determines handoff needed (intent classification in workflow)
2. Worker updates chats.status = 'human' in Supabase
3. Realtime event triggers conversation list refresh in browser
4. Atendente sees conversation move to "Aguardando" / "Em andamento" queue
5. Atendente opens chat → messages fetched via React Query
6. Atendente sends message → supabase.functions.invoke('send-whatsapp')
7. Edge Function calls Z-API with server-side token
```

---

## Suggested Phase Build Order

Based on the dependency graph of the issues found and the domain architecture above:

### Phase 1 — Foundation Hardening (unblock everything else)

| Work Item | Why First |
|-----------|-----------|
| Consolidate to single Supabase client | Every Realtime and auth fix depends on this |
| Move Z-API calls to Edge Function | Security prerequisite; token rotation needed |
| Fix dual `useEffect` init race in AuthContext | Auth bugs affect every page |
| Fix `fetchConversations` all-messages query | Performance baseline; DB trigger or DISTINCT ON |

Rationale: All subsequent phases touch auth, Realtime, and data fetching. A broken foundation means every improvement built on top has unpredictable behavior.

### Phase 2 — React Query Migration + Realtime Fix

| Work Item | Why Second |
|-----------|------------|
| Migrate `fetchConversations` + `fetchMessages` to `useQuery` | Requires single Supabase client (Phase 1) |
| Add `bot_id` filter to sidebar Realtime channel | Requires correct client (Phase 1) |
| Fix `selectedConversation.id` as effect dependency | Quick win; reduces unnecessary channel churn |
| Migrate `sendMessage` to `useMutation` + optimistic update | Correct mutation pattern |

Rationale: Once the data layer is stable, all UI work in later phases can use the correct hooks pattern.

### Phase 3 — n8n Queue Mode

| Work Item | Why Third |
|-----------|-----------|
| Provision Redis + PostgreSQL for n8n | Infrastructure prerequisite for queue mode |
| Convert n8n to queue mode with 2 workers | Can be done without touching the React SPA |
| Add retry + circuit breaker logic to n8n workflows | Requires stable worker architecture |
| Add GCP credential health-check cron workflow | Requires Error Workflow feature (available in queue mode) |

Rationale: n8n changes are independent of the React SPA. Can be done in parallel with Phase 2 by a second engineer if available.

### Phase 4 — Bug Fixes + Data Integrity

| Work Item | Why Fourth |
|-----------|------------|
| Fix `autoTransfer` not persisted | Data correctness; low risk |
| Fix `instrucoesFinais` discarded on save | Data correctness |
| Fix `reportContact` stub → DB write | User-facing correctness |
| Fix `fetchBotPdfs` slug vs ID mismatch | Functionality blocker for PDF feature |
| Fix `BotContext` non-admin bot filter | RBAC correctness for invited users |
| Fix `ConversationList` `agent-1` hardcoded filter | "Minhas" tab correctness |

### Phase 5 — Real Metrics + Dashboard

| Work Item | Why Fifth |
|-----------|-----------|
| Add `responded_at` timestamp to messages | Prerequisite for real avg response time |
| Replace hardcoded SLA data with real queries | Requires `responded_at` (above) |
| Replace `avgResponseTime` string with real calculation | Requires `responded_at` |
| Real metrics Supabase RPC / view | Reduce N sequential queries to 1 |

Rationale: Metrics require data model changes. Safe to do after data integrity is confirmed.

### Phase 6 — New Features (AI Capabilities)

| Work Item | Why Last |
|-----------|----------|
| TTS — Google Cloud TTS → WhatsApp audio reply | Requires stable n8n queue mode (Phase 3) |
| Image reading via Gemini Vision | Requires stable n8n (Phase 3); partially implemented |
| Internal collaborator bot (separate n8n flow) | Requires queue mode to handle additional load |

---

## Scalability Thresholds

| Concern | Current State | At 50 concurrent | At 200 concurrent |
|---------|--------------|------------------|-------------------|
| n8n execution | Single process — will block | Queue mode + 1–2 workers needed | Queue mode + 4 workers, concurrency 15 |
| Supabase Realtime | Unfiltered global subscription — functional | Add bot_id filter | Filter + consider Broadcast instead of Postgres CDC |
| `fetchConversations` query | Full table scan of messages | DISTINCT ON query or denormalized column | Denormalized `last_message_at` on chats + DB trigger |
| Z-API rate limits | Client-side, uncontrolled | Edge Function allows rate tracking | Edge Function + per-bot rate limiter (token bucket) |
| Dashboard queries | 4 sequential queries | `Promise.all` for independent queries | Single Supabase RPC returning aggregate data |

---

## Sources

- [n8n Queue Mode Configuration](https://docs.n8n.io/hosting/scaling/queue-mode/) — HIGH confidence
- [n8n Concurrency Control](https://docs.n8n.io/hosting/scaling/concurrency-control/) — HIGH confidence
- [n8n Scaling Overview](https://docs.n8n.io/hosting/scaling/overview/) — HIGH confidence
- [n8n Error Handling](https://docs.n8n.io/flow-logic/error-handling/) — HIGH confidence
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime) — HIGH confidence
- [Supabase Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets) — HIGH confidence
- [Supabase Securing Edge Functions](https://supabase.com/docs/guides/functions/auth) — HIGH confidence
- [TanStack Query + Supabase — Makerkit](https://makerkit.dev/blog/saas/supabase-react-query) — MEDIUM confidence
- [n8n Queue Mode — Elest.io](https://blog.elest.io/how-to-scale-n8n-with-redis-queue-mode-for-parallel-workflow-execution/) — MEDIUM confidence
- [n8n Error Handling Patterns — PageLines](https://www.pagelines.com/blog/n8n-error-handling-patterns) — MEDIUM confidence
- [n8n API Integration Patterns — Serenichron](https://serenichron.com/articles/api-integration-patterns-business-automation-n8n/) — MEDIUM confidence
- [Advanced n8n Error Handling — Wednesday.is](https://www.wednesday.is/writing-articles/advanced-n8n-error-handling-and-recovery-strategies) — MEDIUM confidence
- [Supabase Realtime Cost Optimization](https://techsynth.tech/blog/reducing-supabase-realtime-costs-by-73-percent/) — MEDIUM confidence

# Project Research Summary

**Project:** Kisabot — WhatsApp AI Customer Service Platform
**Domain:** WhatsApp AI customer service (n8n + Vertex AI/Gemini + Supabase + GCP + Z-API)
**Researched:** 2026-04-29
**Confidence:** HIGH

---

## Executive Summary

Kisabot is a self-hosted WhatsApp AI customer service platform targeting 50–200 concurrent conversations for Brazilian SMB and mid-market clients. The established production pattern for this domain uses a workflow orchestrator (n8n) in queue mode with a Redis job broker to separate webhook ingestion from AI execution, a managed AI backend (Vertex AI / Gemini), a realtime-capable Postgres-backed platform (Supabase) as the single source of truth, and a WhatsApp gateway (Z-API) proxied behind server-side secrets. The codebase already covers 80%+ of the table-stakes feature set. The primary work ahead is hardening an existing product that reached production with security shortcuts, unscaled infrastructure, and placeholder data — not building from scratch.

The recommended approach prioritizes removing three active production risks before layering new capabilities. First: the Z-API Client-Token is hardcoded in the browser bundle and must move to a Supabase Edge Function immediately. Second: two independent Supabase clients create auth/Realtime split-brain in `Atendimentos.tsx` and must be consolidated. Third: GCP credentials are configured as OAuth2 with a 7-day expiry limit — replacing them with a Service Account JSON credential eliminates the most common production outage. Only after these three changes are shipped should the team proceed to n8n queue mode, React Query migration, real dashboard metrics, and new AI capabilities (TTS audio responses, internal employee bot).

The key risks post-hardening are: n8n single-process saturation at peak conversation load (mitigated by queue mode + Redis); WhatsApp voice note format rejection if TTS audio is not explicitly encoded as OGG/Opus 48kHz (not MP3); prompt injection via image and audio transcription fed directly into the agent context; and incremental data integrity decay from the remaining hardcoded stub functions (mock contacts, fake SLA metrics, discarded `reportContact` submissions). All risks have documented mitigations with high confidence — none require novel engineering.

---

## Key Findings

### Recommended Stack

The existing stack is appropriate and should not change. The required changes are configuration and deployment pattern upgrades, not technology replacements. n8n must move from single-process to queue mode (adding Redis 7 and PostgreSQL 16 as infrastructure dependencies). TanStack React Query v5 is already installed but unused — it should replace the current `useState`/`useEffect` fetch patterns. The GCP credential type in n8n must change from OAuth2 to Service Account. No new npm packages or third-party vendors are needed.

**Core technologies:**

- **n8n (queue mode) + Redis + PostgreSQL:** Workflow orchestration and AI agent execution — queue mode is mandatory to decouple webhook ingestion from AI execution at 50+ concurrency
- **Vertex AI Gemini 2.5 Flash:** Text generation, vision (image analysis), and TTS orchestration — natively multimodal, no separate vision model needed
- **Google Cloud TTS (REST v1):** OGG_OPUS output natively; matched to WhatsApp voice note format requirement without transcoding
- **GCP Service Account (JSON key):** Replaces OAuth2 credentials in n8n — no 7-day expiry, auto-refresh, purpose-built for backend automation
- **Supabase JS (single client singleton):** DB queries + Realtime + Edge Functions — dual client in current code must be eliminated before any Realtime work
- **TanStack React Query v5:** Server state cache, deduplication, background refetch — already installed, migration replaces fragile `useState`/`useEffect` patterns
- **Supabase Edge Function (send-whatsapp proxy):** Moves Z-API Client-Token off the browser bundle — standard secret proxy pattern
- **Uptime Kuma + n8n Error Workflow:** Level 1+2 alerting for GCP credential drops and n8n process health — deployable without Prometheus/Grafana overhead

### Expected Features

**Must have (table stakes) — all exist, some broken:**
- 24/7 automated text responses — exists
- Multi-turn conversation context — exists (Supabase history)
- Conversation history and full transcript — exists
- Human takeover / agent escalation — exists (manual via panel)
- RBAC (admin / supervisor / atendente / visualizador) — exists
- Multi-bot support — exists
- Inbound audio transcription — exists (partial, in n8n flow)
- Inbound image processing — exists (partial, Gemini Vision)
- PDF / knowledge base ingestion — exists
- Real-time conversation updates — exists (Supabase Realtime, currently buggy)
- Contact management — exists
- Real metrics dashboard — exists but all data is mocked (active liability)
- Secure credential handling — **MISSING** — Z-API token hardcoded in client JS (P0 fix)

**Should have (differentiators) — not yet implemented:**
- TTS outbound audio (voice note responses) — highest differentiation value for Brazilian market; stack is ready
- Internal employee bot (separate n8n flow + knowledge base) — high business value, clear architecture path
- Automatic GCP credential reconnect + proactive alerting — eliminates the most common operational outage

**Defer to v2+:**
- Persistent cross-session memory / user profiling (requires pgvector, significant schema work)
- Proactive outbound campaigns (WhatsApp template approval process is slow; regulatory complexity)
- Omnichannel (Telegram, Instagram) — explicitly out of scope
- Prometheus + Grafana full observability stack (Level 3 monitoring — not urgent at current scale)

### Architecture Approach

The target architecture separates concerns across four execution planes: the React SPA communicates exclusively through Supabase JS (auth, DB, Realtime, Edge Functions) and never calls Z-API or GCP directly; n8n in queue mode runs all AI orchestration with a Redis job queue decoupling webhook ingestion from execution; Supabase is the single source of truth for chats, messages, bots, and contacts; and external providers (Z-API, Vertex AI, GCP Storage, Firecrawl) are accessed only from server-side contexts (n8n workers or Edge Functions). The React SPA is a read-heavy consumer that renders what n8n writes to Supabase.

**Major components:**

1. **Supabase Edge Function: send-whatsapp** — proxy for all Z-API calls; holds Client-Token server-side; validates JWT; replaces direct browser-to-Z-API calls in `api.ts`
2. **n8n queue mode: Main + Worker pool + Redis** — Main receives Z-API webhooks and enqueues jobs in under 5ms; Workers execute AI agent workflows independently; Redis (BullMQ) is the broker; PostgreSQL is the shared credential and execution store
3. **React Query + Supabase Realtime hybrid** — React Query owns the cache (initial load, background refetch, deduplication); Realtime subscription events only call `invalidateQueries` or `setQueryData`; Realtime channel filtered by `bot_id` to prevent event floods; `selectedConversation.id` (not object) as `useEffect` dependency to prevent channel recreation churn
4. **Single Supabase client singleton** — `src/integrations/supabase/client.ts` is canonical; `src/lib/supabase.ts` is deleted; all auth and Realtime state is shared through one WebSocket connection per browser tab
5. **n8n Error Workflow + GCP health-check cron** — catches `401`/`UNAUTHENTICATED` errors from Vertex and GCS nodes; sends Slack/webhook alert; periodic cron pings GCP endpoint to detect credential failure before customers notice

### Critical Pitfalls

1. **GCP OAuth2 7-day token expiry loop** — Switch ALL GCP credentials in n8n to Service Account (JSON key). OAuth2 credentials for an "External / Testing" app expire silently every 7 days with no alert, causing the AI agent to stop responding without any error surfaced to operators. Service Account tokens auto-refresh with no user consent. Do this before any other n8n changes.

2. **Z-API Client-Token hardcoded in browser bundle** — The token is in `src/lib/api.ts` and in the committed n8n flow JSON. Any DevTools inspection exposes it. Move all Z-API calls to a Supabase Edge Function, store the token in Supabase Secrets, and rotate the token immediately after migration. This is a P0 security fix.

3. **Dual Supabase clients causing Realtime auth split-brain** — `src/lib/supabase.ts` is a second independent client. On auth token refresh, only the primary client receives the new token; the secondary's Realtime WebSocket fails silently. Delete `src/lib/supabase.ts` and update all imports before any Realtime or React Query work.

4. **n8n single-process collapse at 50+ concurrent conversations** — Default n8n runs webhook ingestion and AI execution in one event loop. At 50+ concurrent WhatsApp messages, the event loop saturates, executions queue indefinitely, and in-flight messages are dropped silently. Enable queue mode with Redis + PostgreSQL + 2–4 worker processes (`--concurrency=15` per worker). Also set `EXECUTIONS_DATA_PRUNE=true` to prevent execution history OOM death.

5. **TTS audio format rejection by WhatsApp** — Google Cloud TTS defaults to MP3. WhatsApp voice notes require OGG with Opus codec at 48kHz mono. Explicitly request `audioEncoding: OGG_OPUS` in every TTS API call; use Z-API's `send-audio` endpoint (not `send-document`) with the PTT flag. Test on a real device — emulators do not accurately reflect codec rejection behavior.

6. **Unfiltered global Realtime subscription at scale** — The `atualiza-sidebar` channel subscribes to all `messages` inserts with no filter. At 50+ connected operators, every incoming message across all bots floods every client. Add `filter: bot_id=eq.${selectedBotId}` to the channel subscription before scaling.

7. **`fetchConversations` all-messages query times out at scale** — Current query fetches all messages for all chats to derive `lastMessage` client-side. Fix with `DISTINCT ON (chat_id) ORDER BY created_at DESC` RPC or a denormalized `last_message_at` trigger on `chats` before migrating to React Query.

---

## Implications for Roadmap

Based on research, the dependency graph is clear and sequential. Phases 1–3 are hardening; Phases 4–6 are features. Phase 3 (n8n infrastructure) can run in parallel with Phase 2 if two engineers are available.

### Phase 1: Foundation Hardening (Security + Auth Stability)

**Rationale:** Three active production risks (exposed token, dual client, GCP credential expiry) must be neutralized before any other work. Every subsequent phase touches auth, Realtime, or data fetching. A broken foundation makes every improvement unpredictable.
**Delivers:** Secure credential handling (Z-API token off browser), single authoritative Supabase auth/Realtime session, stable GCP credential that does not expire, alert when n8n credential fails.
**Addresses:** Secure credential handling (table stakes MISSING), GCP auto-reconnect (differentiator partial).
**Avoids:** Pitfalls 1 (GCP OAuth2 expiry), 2 (Z-API token exposure), 3 (dual Supabase client).

Work items:
- Delete `src/lib/supabase.ts`; migrate all imports to `src/integrations/supabase/client.ts`
- Create `supabase/functions/send-whatsapp` Edge Function; remove token from `api.ts`; rotate exposed token
- Replace GCP OAuth2 credentials in n8n with Service Account JSON key
- Add n8n Error Workflow + hourly GCP health-check cron (Level 1+2 alerting)
- Update Deno std import version in existing Edge Functions (currently pinned at 0.168.0 from 2022)

### Phase 2: Data Layer Stabilization (React Query + Realtime Fix)

**Rationale:** Requires Phase 1 (single client) to be complete. Must fix `fetchConversations` query before migrating to React Query or caching will amplify the broken query. Migrate Dashboard (no Realtime) first as a warm-up before touching `Atendimentos.tsx`.
**Delivers:** Correct caching, deduplicated Realtime subscriptions filtered by `bot_id`, no duplicate messages, no channel-recreation churn, stable conversation list.
**Avoids:** Pitfalls 4 (React Query + Realtime split-brain), 5 (unfiltered global subscription), 9 (`fetchConversations` all-messages).

Work items:
- Fix `fetchConversations` with `DISTINCT ON` RPC or denormalized `last_message_at` trigger
- Migrate Dashboard to `useQuery` (no Realtime dependency — safe warmup)
- Migrate `Atendimentos.tsx` fetch logic to `useQuery` + `useMutation`
- Add `bot_id` filter to sidebar Realtime channel
- Use `selectedConversation.id` as `useEffect` dependency (not full object)
- Fix composite session key in `memoryPostgresChat` node: `${botId}_${phone}`

### Phase 3: n8n Queue Mode Infrastructure

**Rationale:** Independent of the React SPA — can run in parallel with Phase 2. Required before TTS or internal bot (Phase 6) adds load. Execution history pruning must be enabled at the same time as queue mode to prevent gradual OOM.
**Delivers:** Horizontal scaling to 50–200 concurrent conversations, no webhook ingestion starvation, circuit breaker + retry patterns for Vertex AI and Z-API calls.
**Avoids:** Pitfall 2 (n8n single-process saturation), Pitfall 7 (execution history OOM).

Work items:
- Add Redis 7-alpine and PostgreSQL 16-alpine to Docker Compose
- Set `EXECUTIONS_MODE=queue`, `N8N_ENCRYPTION_KEY` (byte-identical on all instances), `DB_TYPE=postgresdb`
- Add `n8n-worker` service with `--concurrency=15`; start with 2 workers
- Set `EXECUTIONS_DATA_PRUNE=true`, `EXECUTIONS_DATA_MAX_AGE=168`
- Use GCS (not filesystem mount) for all binary data passing between n8n steps
- Add retry + circuit breaker logic (Supabase `api_circuit_breakers` table) for Vertex AI and Z-API calls

### Phase 4: Bug Fixes + Data Integrity

**Rationale:** These are correctness fixes that unblock accurate metrics (Phase 5) and prevent silent data loss. Low individual risk; should be batched together to keep scope contained.
**Delivers:** All bot config fields actually persisted, PDF fetch working by slug, RBAC correct for invited users, `reportContact` writing to DB.
**Avoids:** Pitfall 11 (hardcoded fallback data masking errors), Pitfall 14 (InviteFlow role self-assignment).

Work items:
- Fix `autoTransfer` not persisted on save
- Fix `instrucoesFinais` discarded on save
- Fix `reportContact` stub → real DB write
- Fix `fetchBotPdfs` slug vs ID mismatch
- Fix `BotContext` non-admin bot filter for invited users
- Fix `ConversationList` `agent-1` hardcoded filter for "Minhas" tab
- Move invite role assignment to Edge Function or `SECURITY DEFINER` DB function

### Phase 5: Real Metrics Dashboard

**Rationale:** Requires Phase 4 data integrity to be confirmed (no stub functions polluting data). Schema additions (`responded_at`, `first_response_at`) are low-risk but must precede query rewrites.
**Delivers:** Dashboard showing real SLA, response time, volume metrics; operators can trust the numbers they act on.
**Avoids:** Pitfall 11 (fabricated metrics used for decisions).

Work items:
- Add `responded_at` and `first_response_at` timestamp columns to `messages` (migration)
- Replace hardcoded SLA strings with real Supabase RPC returning aggregate data
- Replace `avgResponseTime` `'1m 20s'` literal with calculated value
- Consolidate 4 sequential dashboard queries into a single RPC call

### Phase 6: New AI Capabilities

**Rationale:** Requires stable n8n queue mode (Phase 3) to handle additional concurrent load. TTS depends on correctly configured GCP Service Account (Phase 1). Internal bot requires RBAC correctness (Phase 4).
**Delivers:** Voice note responses (highest differentiation in Brazilian market), internal employee bot with isolated knowledge base, complete image reading pipeline with panel rendering.
**Avoids:** Pitfall 6 (TTS audio format incompatibility), Pitfall 8 (prompt injection via image/audio content).

Work items:
- TTS: add n8n HTTP Request node → Google Cloud TTS (`OGG_OPUS` encoding); upload to GCS; Z-API `send-audio` with PTT flag; cap text at 500 chars
- Image reading: complete Gemini Vision pipeline in n8n; add image message rendering in `ChatWindow.tsx`
- Internal bot: new n8n workflow (isolated); separate GCS bucket with private ACL; `is_internal: true` flag on bot row; `canAccessBot()` RBAC guard
- Add XML delimiter wrapping for all user-provided content entering AI Agent context (prompt injection hardening)
- Extract `Treinamento.tsx` sub-features to isolated components before adding TTS config UI

### Phase Ordering Rationale

- Phase 1 must precede all other phases — the dual client and exposed token create cascading failures in auth, Realtime, and security that make every subsequent change unpredictable.
- Phase 2 must follow Phase 1 — React Query requires a single Supabase client; the `fetchConversations` query fix must precede React Query migration to avoid caching a broken query.
- Phase 3 can run in parallel with Phase 2 — n8n infrastructure is entirely independent of the React SPA; a second engineer can work on this simultaneously.
- Phase 4 must precede Phase 5 — dashboard metrics are meaningless if stub functions are still polluting data and bot config fields are not persisted.
- Phase 6 must follow Phase 3 — TTS and internal bot add concurrent n8n workload; queue mode must be in place to absorb it without saturating the main process.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (n8n Queue Mode):** Docker Compose topology and `N8N_ENCRYPTION_KEY` distribution across services are environment-specific; validate exact env var names against installed n8n version before execution
- **Phase 6 (TTS):** Z-API PTT flag behavior is implementation-specific and version-dependent; must be verified against the current Z-API instance version with a sandbox test before writing the n8n flow
- **Phase 6 (Prompt injection hardening):** XML delimiter instruction effectiveness varies by Gemini model version; test with actual adversarial inputs against the specific Gemini 2.5 Flash model in use

Phases with well-documented standard patterns (skip research-phase):
- **Phase 1 (Supabase Edge Function proxy):** Pattern is fully documented in Supabase official docs; no unknowns
- **Phase 1 (GCP Service Account):** Migration steps are explicit and reversible; high confidence
- **Phase 2 (React Query migration):** TanStack v5 migration guide is comprehensive; library is already installed
- **Phase 5 (Dashboard metrics):** Standard Supabase RPC aggregation; no novel patterns required

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technology choices sourced from official docs; no new vendors needed |
| Features | HIGH | Table stakes validated against competitor analysis; differentiators confirmed in market research |
| Architecture | HIGH | All patterns sourced from official n8n, Supabase, and TanStack documentation |
| Pitfalls | HIGH (critical) / MEDIUM (moderate) | Critical pitfalls (GCP expiry, token exposure, dual client, queue mode) backed by official docs and reproducible community reports; TTS format and Realtime scale pitfalls are MEDIUM — validated against Meta docs and Supabase limits but Z-API behavior is partially implementation-specific |

**Overall confidence:** HIGH

### Gaps to Address

- **Z-API PTT flag behavior:** Documented that `send-audio` with PTT must be used for voice notes, but exact parameter name and behavior may differ across Z-API versions. Validate with a sandbox send before building the TTS n8n flow.
- **Gemini 2.5 Flash inline image size limit:** Research confirms 10MB inline base64 limit, but real-world WhatsApp image sizes (often 3–8MB after Z-API download) should be benchmarked against Vertex API latency. May need GCS URI reference instead of inline base64 for large images.
- **`responded_at` schema change impact on existing RLS policies:** Adding columns to `messages` is low-risk but the existing RLS policies on `messages` should be reviewed before running the migration to confirm no policy references a fixed column list.
- **n8n PostgreSQL connection pool sizing:** At 4 workers × concurrency 15 = 60 concurrent executions, each hitting Supabase via the n8n Supabase nodes, connection pool may need explicit `DB_POSTGRESDB_POOL_SIZE` tuning. Default may be insufficient. Validate during Phase 3 smoke testing.
- **Deno std library upgrade path:** Edge Functions at `deno.land/std@0.168.0` (2022) need to be migrated to current `jsr:@std/*` imports. Must verify that the GCP signing logic in `generate-signed-url` is compatible with the updated APIs before shipping any new Edge Function alongside the old ones.

---

## Sources

### Primary (HIGH confidence)

- https://docs.n8n.io/hosting/scaling/queue-mode/ — n8n queue mode configuration and worker setup
- https://docs.n8n.io/hosting/scaling/concurrency-control/ — n8n concurrency sizing
- https://docs.n8n.io/hosting/scaling/memory-errors/ — execution pruning and OOM prevention
- https://docs.n8n.io/flow-logic/error-handling/ — Error Workflow and retry patterns
- https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize — TTS OGG_OPUS output
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-understanding — Gemini Vision endpoint
- https://supabase.com/docs/guides/functions/secrets — Edge Function secret management
- https://supabase.com/docs/guides/functions/auth — Edge Function JWT verification
- https://supabase.com/docs/guides/realtime — Realtime channel filtering and limits
- https://supabase.com/docs/guides/realtime/limits — Supabase Realtime concurrent connection limits
- https://tanstack.com/query/v5/docs/react/guides/migrating-to-v5 — React Query v5 breaking changes
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/audio-messages/ — WhatsApp audio message format requirements
- https://genai.owasp.org/llmrisk/llm01-prompt-injection/ — LLM prompt injection (OWASP LLM01:2025)

### Secondary (MEDIUM confidence)

- https://ignite-ops.com/resources/2025/03/google-oauth-n8n-keeps-expiring-here-is-the-real-fix/ — GCP Service Account fix for n8n credential expiry
- https://community.n8n.io/t/recurring-google-services-authentication-issue-in-self-hosted-n8n/94402 — Community confirmation of OAuth2 expiry pattern
- https://makerkit.dev/blog/saas/supabase-react-query — Supabase + React Query integration pattern
- https://blog.elest.io/how-to-scale-n8n-with-redis-queue-mode-for-parallel-workflow-execution/ — n8n queue mode production deployment
- https://www.pagelines.com/blog/n8n-error-handling-patterns — Circuit breaker pattern in n8n
- https://blog.ultramsg.com/how-to-send-ogg-file-using-whatsapp-api/ — OGG Opus WhatsApp voice note compatibility
- https://n8n.io/workflows/8251-whatsapp-ai-agent-that-understand-text-image-audio/ — Reference n8n workflow for WhatsApp media handling

---

*Research completed: 2026-04-29*
*Ready for roadmap: yes*

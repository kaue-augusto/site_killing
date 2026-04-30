# Feature Landscape

**Domain:** WhatsApp AI Customer Service Platform
**Project:** Kisabot
**Researched:** 2026-04-29
**Overall confidence:** HIGH (stack-specific details MEDIUM)

---

## Table Stakes

Features users (operators and business owners) expect. Absence makes the product feel incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Kisabot Status |
|---------|--------------|------------|----------------|
| 24/7 automated text responses | Core value of any AI bot — no human needed for common queries | Low | Exists |
| Multi-turn conversation context | 56% of customers report repeating themselves when context is lost; context continuity is expected baseline | Medium | Exists (Supabase history) |
| Conversation history + full transcript | Operators must be able to review what the bot said; compliance and QA requirement | Low | Exists |
| Human takeover / agent escalation | AI fails edge cases; operators must be able to intervene and take over a chat | Medium | Exists (manual via panel) |
| RBAC (role-based access) | Multi-user teams require admin / supervisor / agent permission separation | Medium | Exists (admin/supervisor/atendente/visualizador) |
| Multi-bot support | Companies run multiple WhatsApp numbers / products; single platform must handle all | Medium | Exists |
| Media handling — inbound audio transcription | Voice notes dominate in Brazil and Latin American markets; ignoring them breaks UX | Medium | Exists (partial, in n8n flow) |
| Media handling — inbound image processing | Users send photos of documents, products, issues; bot must understand them | Medium | Exists (partial, Gemini Vision) |
| PDF / knowledge base ingestion | Bot must know about the company's products and policies | Medium | Exists (GCP Storage + upload UI) |
| Dashboard with real metrics | Managers need SLA, volume, and response-time data to run operations | Medium | Exists but mocked — active requirement |
| Contact management | Operators need to see who they're talking to and add context | Low | Exists (Contatos page) |
| Real-time conversation updates | Panel must reflect new messages without manual refresh | Low | Exists (Supabase Realtime) |
| Secure credential handling | API tokens must not be exposed in browser bundles | Low | MISSING — Z-API token hardcoded in client JS |

---

## Differentiators

Features that set the product apart. Not universally expected, but create competitive advantage.

| Feature | Value Proposition | Complexity | Kisabot Status | Priority |
|---------|-------------------|------------|----------------|----------|
| TTS — outbound audio (voice note) responses | Bot responds as a voice note; dramatically more natural on WhatsApp; rare among competitors in Brazil SMB market | High | Not implemented — active requirement | HIGH |
| Internal agent (employee-facing) | Separate bot/flow for collaborators with HR/ops knowledge base; prevents internal data leaking to customers; single platform for all WhatsApp automation | High | Not implemented — active requirement | HIGH |
| Automatic GCP credential reconnection | Eliminates manual intervention on credential expiry; competitors relying on manual ops have higher downtime | Medium | Not implemented — active requirement | HIGH |
| Proactive alerting + flow health monitoring | Ops team notified before customers notice downtime; Slack/email alerts on n8n failures or latency spikes | Medium | Not implemented — active requirement | HIGH |
| CRM pipeline (Kanban lead management) | Combines support and sales in one tool; reduces need for a separate CRM for smaller teams | Medium | Exists (Crm.tsx with drag-and-drop) | MEDIUM |
| Web scraping as a tool for AI agent | Bot always answers from live website content, not just static PDFs | Medium | Exists (Firecrawl) | MEDIUM |
| Signed URL media delivery | PDFs and documents delivered via expiring signed URLs — secure and compliant | Low | Exists (Edge Function) | LOW |
| Persistent memory / user profiling | Bot remembers prior interactions across sessions; personalises responses | High | Not implemented, out of scope this milestone | LOW |
| Proactive outbound campaigns | Bot initiates conversations (abandoned cart, appointment reminders); requires WhatsApp template approval | High | Out of scope this milestone | LOW |
| Omnichannel (Telegram, Instagram, etc.) | Expand beyond WhatsApp to other messaging channels | Very High | Explicitly out of scope | SKIP |

---

## Anti-Features

Features to explicitly avoid or defer.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Redux / Zustand global state store | Adds complexity; React Query + Context is sufficient for this volume | Use React Query for server state, Context for auth/bot selection |
| Native mobile app | Responsive web panel is sufficient for operators at this scale | Keep web panel, ensure mobile-responsive layout |
| Multi-channel support (non-WhatsApp) | Dilutes focus; Z-API and n8n flows are WhatsApp-specific | Remain WhatsApp-only until core feature set is solid |
| Custom AI model training | Vertex AI / Gemini is a managed service; fine-tuning adds ops overhead without proportional gain | Use RAG (PDFs + Firecrawl) for domain knowledge instead |
| Exposing Z-API token to client | Security vulnerability; token in JS bundle is readable by any user | Move to Supabase Edge Function or server-side proxy |
| Keeping dual Supabase clients | Causes session inconsistency and duplicate Realtime channels | Consolidate to single canonical client at `src/integrations/supabase/client.ts` |
| Mock data in production dashboard | Erodes trust; operators making decisions on fake metrics is a liability | Replace all hardcoded SLA and response-time values with real Supabase queries |

---

## Feature Dependencies

```
TTS (outbound audio)
  └── requires: Google Cloud TTS API credentials (already in GCP stack)
  └── requires: ffmpeg or equivalent transcoding in n8n (OGG/Opus 48kHz mono 32kbps)
  └── requires: Z-API send-audio endpoint with PTT flag
  └── requires: Publicly accessible URL or base64 for audio payload

Image Reading (inbound)
  └── requires: Gemini Vision model call in n8n (partially exists)
  └── requires: Message type routing in n8n webhook handler (partially exists)

Internal Agent
  └── requires: Separate n8n workflow (independent from customer flow)
  └── requires: Separate knowledge base (GCS bucket or Supabase schema)
  └── requires: Separate bot row in `bots` table with distinct slug
  └── requires: RBAC: internal bot not visible to external-customer flows

Auto GCP Reconnect
  └── requires: Credential health-check node in n8n (periodic ping to GCP)
  └── requires: Token refresh logic (GCP service account key rotation or OAuth refresh)
  └── requires: Error trap in main workflow that triggers reconnect sub-flow

n8n Monitoring + Alerting
  └── requires: n8n /healthz/readiness endpoint polling
  └── requires: Prometheus/Grafana OR lightweight webhook-based alerting to Slack/email
  └── requires: Threshold definition: >5% failure rate in 5 min = P1 alert

Real Dashboard Metrics
  └── requires: Supabase queries on `messages` and `chats` tables
  └── requires: Schema additions if SLA fields (first_response_at, resolved_at) don't exist
```

---

## TTS Implementation Pattern — WhatsApp Audio (OGG/Opus)

**Context:** Kisabot uses Z-API for WhatsApp. TTS is planned via Google Cloud TTS (already in GCP stack).

### Required audio spec
- Container: OGG
- Codec: Opus
- Sample rate: 48000 Hz
- Channels: Mono (1)
- Bitrate: 32 kbps recommended
- Flag: Must be sent as PTT (push-to-talk), not a file attachment

### n8n Flow Steps
1. AI Agent generates text response
2. HTTP Request node → Google Cloud TTS API (`POST /v1/text:synthesize`)
   - Voice: `pt-BR-Wavenet-*` or `pt-BR-Standard-*` for Portuguese
   - Audio encoding: `OGG_OPUS` (Google TTS natively outputs this — no transcoding required)
3. Save audio to GCS or base64-encode in memory
4. Z-API send-audio endpoint with PTT parameter set to `true`
   - Endpoint: `POST https://api.z-api.io/instances/{id}/token/{token}/send-audio`
   - The `phone` and audio URL / base64 payload must be provided
   - Audio must be at a publicly accessible URL (or base64 if Z-API supports it)
5. Log message row in `messages` table with `type = 'audio'`

### Key Risk
Google Cloud TTS outputs `OGG_OPUS` natively — this is the format WhatsApp PTT requires. However, Z-API's behavior with PTT flag must be verified against the current version in use. Some versions of WhatsApp gateway APIs silently deliver audio as a file attachment instead of a voice note when the PTT flag is missing or the mime-type is incorrect.

**Confidence:** MEDIUM — Google TTS → OGG Opus output is documented. Z-API PTT behavior is implementation-specific and should be tested with a sandbox message before deploying.

---

## Internal Agent vs External Agent Separation

**Pattern: Isolated n8n Workflow + Isolated Knowledge Base**

### Why separate
- Internal knowledge (salaries, processes, org structure) must never be surfaced to external customers
- Security boundary is enforced at the workflow level, not just at prompt level — prompt injection could bypass system prompt guards
- Separate bot row in `bots` table means separate Z-API instance (separate WhatsApp number)

### Recommended architecture
```
External Customer Flow (existing)
  WhatsApp number A → Z-API instance A → n8n workflow: WhatsApp-GCP_completo
  Knowledge base: public PDFs in GCS bucket A, Firecrawl (public website)

Internal Employee Flow (new)
  WhatsApp number B → Z-API instance B → n8n workflow: WhatsApp-Internal (new)
  Knowledge base: internal PDFs in GCS bucket B (private, separate ACL)
  Additional tools: VerificarMatricula (already exists), HR lookups
```

### RBAC integration
- Internal bot row in `bots` table should have a flag (e.g., `is_internal: true`)
- `canAccessBot()` in `AuthContext` should restrict internal bot visibility to `admin` and `supervisor` roles
- Prevents `atendente` and `visualizador` from accidentally routing customers to the internal flow

**Confidence:** HIGH — pattern is consistent with privilege separation best practices and aligns with existing Kisabot multi-bot architecture.

---

## n8n Flow Health Monitoring Pattern

**Context:** n8n is self-hosted. GCP credentials expire unpredictably, causing silent failures.

### Monitoring endpoints available in n8n
- `GET /healthz` — HTTP 200 if process is alive (does NOT verify DB)
- `GET /healthz/readiness` — HTTP 200 if DB is connected and migrated; HTTP 503 otherwise
- `GET /metrics` — Prometheus-compatible metrics endpoint (must be enabled via env var `N8N_METRICS=true`)

### Recommended alerting strategy for Kisabot

**Level 1 — Lightweight (quick win):**
- External cron (e.g., Supabase Edge Function on schedule, or UptimeRobot free tier) polls `/healthz/readiness` every 60 seconds
- On HTTP 503 or timeout → POST to Slack webhook or send email
- Implementation time: ~2 hours

**Level 2 — Workflow-level (more robust):**
- Add an Error Trigger node to the main WhatsApp workflow in n8n
- On any unhandled execution error → send Slack/email notification with workflow name, error message, timestamp
- Track GCP credential errors specifically (match error message pattern) and trigger credential refresh sub-flow
- Implementation time: ~4 hours

**Level 3 — Full observability (optional, higher effort):**
- Enable `N8N_METRICS=true` on n8n instance
- Prometheus scrapes `/metrics` endpoint
- Grafana dashboard shows execution counts, failure rates, p95 latency
- Alert rules: >5% failure rate over 5 minutes = P1

**Recommended for Kisabot this milestone:** Level 1 + Level 2. Enough signal to detect the GCP credential drop and n8n process crash without Prometheus/Grafana overhead.

**Confidence:** HIGH — n8n health endpoints are documented. Alert threshold patterns are production best practices.

---

## MVP Feature Priority for Active Requirements

Ordered by business impact and implementation risk:

1. **Fix critical security bug** — Z-API token out of client bundle (blocker for any production deployment)
2. **Fix dual Supabase client** — Causes session and Realtime inconsistency (reliability blocker)
3. **Real dashboard metrics** — Operators are making decisions on fake data (trust blocker)
4. **n8n monitoring + alerting (Level 1+2)** — GCP credential drop is the #1 operational pain point
5. **TTS — outbound audio** — High differentiation value; Google TTS is already in stack
6. **Internal agent** — High business value; requires new n8n workflow and knowledge base setup
7. **Auto GCP reconnect** — Reduces manual intervention; depends on monitoring being in place first
8. **Image reading (inbound)** — Partially exists in n8n flow; needs panel rendering in ChatWindow
9. **React Query migration** — Developer experience and performance; enables caching and background refresh
10. **reportContact functional** — Minor user-facing feature; low risk

**Defer:**
- Outbound campaigns (template approval process is slow; adds regulatory complexity)
- Persistent cross-session memory (requires vector store or Supabase pgvector; significant schema work)
- Prometheus/Grafana full stack (Level 3 monitoring — nice-to-have, not urgent)

---

## Sources

- [Best WhatsApp AI Customer Support Platforms (Crisp, 2026)](https://crisp.chat/en/blog/best-whatsapp-support-platform/)
- [Voice Messages using WhatsApp API (WappBiz, 2025)](https://www.wappbiz.com/blogs/voice-messages-using-whatsapp-api/)
- [Send Voice Messages via WhatsApp API — Wassenger (Medium)](https://medium.com/@wassengerlabs/send-voice-messages-via-whatsapp-api-code-examples-included-a136a7f1d286)
- [n8n Monitoring and Alerting Setup for Production (Wednesday.is)](https://www.wednesday.is/writing-articles/n8n-monitoring-and-alerting-setup-for-production-environments)
- [n8n Monitoring Docs](https://docs.n8n.io/hosting/logging-monitoring/monitoring/)
- [WhatsApp AI Agent: The Future of 24/7 Customer Support (AiSensy, 2025)](https://m.aisensy.com/blog/whatsapp-ai-agent-for-customer-support/)
- [Best AI for WhatsApp Feature-by-Feature Comparison (BitBytes, 2025)](https://www.bitbytes.io/blog/best-ai-for-whatsapp)
- [n8n workflow template — WhatsApp AI agent understanding text, image, audio](https://n8n.io/workflows/8251-whatsapp-ai-agent-that-understand-text-image-audio/)
- [WhatsApp Multi-Agents Overview (ActiveCampaign)](https://www.activecampaign.com/blog/whatsapp-multi-agent-inbox)

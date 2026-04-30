# Kisabot — Roadmap

**Milestone:** v1 Hardening & AI Capabilities
**Granularity:** Coarse
**Phases:** 4
**Requirements coverage:** 28/28 ✓

---

## Phases

- [ ] **Phase 1: Foundation Hardening** — Remove active production security risks and stabilize the auth/credential layer
- [ ] **Phase 2: React & Supabase Stabilization** — Migrate data-fetching to React Query, fix Realtime subscriptions, and repair critical data-loss bugs
- [ ] **Phase 3: n8n Scale Infrastructure** — Move n8n to queue mode with Redis and implement full monitoring and alerting
- [ ] **Phase 4: AI Capabilities — Image & TTS** — Complete the image-reading pipeline and add outbound voice note responses

---

## Phase Details

### Phase 1: Foundation Hardening
**Goal**: The platform runs in production without exposing secrets or suffering credential-expiry outages
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, INFRA-01
**Success Criteria** (what must be TRUE):
  1. No Z-API Client-Token appears in the browser bundle or network requests from the React SPA — all Z-API calls are proxied through a Supabase Edge Function
  2. The codebase contains exactly one Supabase client instance; `src/lib/supabase.ts` is deleted and all imports resolve to `src/integrations/supabase/client.ts`
  3. GCP credentials in n8n are Service Account JSON — no OAuth2 credential with a 7-day expiry remains configured
  4. Sensitive environment variables (Z-API token, GCP credentials) exist only in Supabase Secrets or server-side env files — not committed to git or present in any client bundle
**Plans**: TBD

### Phase 2: React & Supabase Stabilization
**Goal**: The React SPA fetches and mutates data correctly, with stable Realtime subscriptions and no silent data-loss bugs
**Depends on**: Phase 1
**Requirements**: INFRA-02, INFRA-03, BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. `Atendimentos.tsx` Realtime subscription is filtered by the selected `bot_id` — operators connected to different bots do not receive each other's events
  2. All fetch and mutation operations in `Atendimentos.tsx` and `Dashboard.tsx` use React Query (`useQuery`/`useMutation`) — no bare `useState`/`useEffect` data-fetching patterns remain in those pages
  3. Saving bot training persists both `autoTransfer` and `instrucoesFinais` (with identity appended) to the `bots` table — values survive a page reload
  4. `fetchContacts` on error returns an empty array with a visible toast — mock contact data never appears in production
  5. Generating a QR code triggers exactly one Z-API call — the duplicate call is eliminated
**Plans**: TBD
**UI hint**: yes

### Phase 3: n8n Scale Infrastructure
**Goal**: n8n can handle 50–200 concurrent conversations without saturation, with automatic alerting when anything fails
**Depends on**: Phase 1
**Requirements**: N8N-01, N8N-02, N8N-03, N8N-04, GCP-01, GCP-02, GCP-03, MON-01, MON-02, MON-03
**Success Criteria** (what must be TRUE):
  1. n8n runs in queue mode with Redis as broker and at least 2 independent worker processes — a load test of 50+ simultaneous webhook requests shows no dropped executions
  2. All n8n processes (main and workers) share the same `N8N_ENCRYPTION_KEY` — credentials decrypt correctly on every worker without manual intervention
  3. The n8n main flow has been running without a manual GCP credential reconnect for at least 30 consecutive days after Service Account migration
  4. An automated alert (Slack webhook or email) fires within 5 minutes when any GCP credential fails or any n8n workflow execution ends in error
  5. An external health-check monitors `/healthz/readiness` on the n8n instance and sends an alert when the endpoint is unreachable
  6. Critical n8n nodes (Vertex AI, Supabase, Z-API) have retry logic with exponential backoff configured — transient failures self-recover without manual workflow re-runs
**Plans**: TBD

### Phase 4: AI Capabilities — Image & TTS
**Goal**: The AI agent processes inbound images from users and can respond with WhatsApp voice notes
**Depends on**: Phase 3
**Requirements**: IMG-01, IMG-02, IMG-03, TTS-01, TTS-02, TTS-03, TTS-04, TTS-05
**Success Criteria** (what must be TRUE):
  1. A user who sends an image via WhatsApp receives an AI response that demonstrates awareness of the image content — Gemini Vision analysis is injected into the agent context
  2. Images sent by users appear in the React panel ChatWindow as a thumbnail or an image indicator — operators can see that an image was exchanged
  3. A sandbox test confirms the current Z-API instance accepts the PTT flag on `send-audio` before the TTS flow is deployed to production
  4. When the bot is configured to respond in audio, it sends an OGG Opus voice note via WhatsApp — the message plays as a voice note (not a file attachment) on the recipient's phone
  5. The n8n flow selects audio vs text response mode based on a configurable criterion (prompt flag or keyword) — the decision logic is visible and adjustable without editing the workflow directly
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Hardening | 0/? | Not started | - |
| 2. React & Supabase Stabilization | 0/? | Not started | - |
| 3. n8n Scale Infrastructure | 0/? | Not started | - |
| 4. AI Capabilities — Image & TTS | 0/? | Not started | - |

---

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| SEC-01 | 1 |
| SEC-02 | 1 |
| SEC-03 | 1 |
| INFRA-01 | 1 |
| INFRA-02 | 2 |
| INFRA-03 | 2 |
| BUG-01 | 2 |
| BUG-02 | 2 |
| BUG-03 | 2 |
| BUG-04 | 2 |
| N8N-01 | 3 |
| N8N-02 | 3 |
| N8N-03 | 3 |
| N8N-04 | 3 |
| GCP-01 | 3 |
| GCP-02 | 3 |
| GCP-03 | 3 |
| MON-01 | 3 |
| MON-02 | 3 |
| MON-03 | 3 |
| IMG-01 | 4 |
| IMG-02 | 4 |
| IMG-03 | 4 |
| TTS-01 | 4 |
| TTS-02 | 4 |
| TTS-03 | 4 |
| TTS-04 | 4 |
| TTS-05 | 4 |

**Total v1 mapped: 28/28 ✓**

---

*Roadmap created: 2026-04-29*
*Last updated: 2026-04-29 after initialization*

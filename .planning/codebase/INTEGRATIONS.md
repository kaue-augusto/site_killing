# External Integrations

**Analysis Date:** 2026-04-29

## APIs & External Services

**WhatsApp Messaging (Z-API):**
- Z-API — WhatsApp Business API provider; used to send and receive messages, generate QR codes, check connection status, and disconnect instances
  - SDK/Client: Native `fetch` calls directly in `src/lib/api.ts`
  - Base URL: `https://api.z-api.io/instances/{instanceId}/token/{token}/`
  - Endpoints used:
    - `POST /send-text` — Send text messages
    - `POST /send-image` — Send image attachments
    - `POST /send-audio` — Send audio messages
    - `POST /send-document` — Send file/document attachments
    - `GET /qr-code/image` — Generate WhatsApp QR code for pairing
    - `GET /status` — Check WhatsApp connection status
    - `GET /disconnect` — Disconnect WhatsApp instance
  - Auth: `Client-Token` header (hardcoded value in `src/lib/api.ts`); per-bot `zapi_instance` and `zap_token` stored in `bots` table
  - Configuration: Bot-level credentials stored in Supabase `bots` table columns `zapi_instance` and `zap_token`

**Automation Workflows (n8n):**
- n8n — Workflow automation platform; webhook URL configurable per bot
  - Integration: UI input field in `src/pages/Treinamento.tsx` (`n8nWebhookUrl` state)
  - Storage: Stored in `bots` table (referenced via `BotTrainingConfig.n8nWebhookUrl` in `src/lib/api.ts`)
  - Pattern: Bot-level configurable; no hardcoded n8n endpoint in source

## Data Storage

**Databases:**
- Supabase (PostgreSQL) — Primary data store for all application data
  - Connection: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` env vars
  - Client: `@supabase/supabase-js` v2; typed client via `src/integrations/supabase/client.ts`
  - Secondary client (untyped): `src/lib/supabase.ts` (used in `src/pages/Atendimentos.tsx` for realtime)
  - Tables (from migrations):
    - `bots` — Bot definitions, WhatsApp credentials, training instructions
    - `profiles` — User profiles linked to `auth.users`
    - `user_roles` — RBAC roles per user per bot (roles: admin, supervisor, atendente, visualizador)
    - `invites` — Pending user invitations with token-based acceptance
    - `chats` — Conversation threads (contact phone, status, bot assignment)
    - `messages` — Individual messages within chats (content, sender_type, media_url)
    - `whatsapp_connections` — WhatsApp connection status per bot
    - `whatsapp_connection_logs` — Audit log for WhatsApp connect/disconnect actions
    - `arquivos_bot` — PDF/file references uploaded per bot (GCP path stored)
    - `bot_qa` — Q&A training pairs per bot
    - `bot_textos` — Free-text training content per bot
  - RLS: Enabled on all tables; admin/supervisor/atendente/visualizador role-based policies
  - PostgREST version: 14.1 (from generated types)

**File Storage:**
- Google Cloud Storage (GCS) — PDF and document file storage for bot training materials
  - Bucket: `n8n-flow`
  - Path pattern: `{botId}/{fileName}`
  - Public URL: `https://storage.googleapis.com/n8n-flow/{fileName}`
  - Upload path: client → Supabase Edge Function `upload-gcp-pdf` → GCS bucket
  - Secure read path: client → Supabase Edge Function `generate-signed-url` → GCS API → base64 response
  - Auth: GCP service account JSON stored as Supabase secret `GCP_CREDENTIALS`

**Caching:**
- TanStack React Query (in-memory, client-side only) — Query result caching for Supabase data
- localStorage — Supabase auth session persistence (`src/integrations/supabase/client.ts` auth config)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth — Email/password authentication with session management
  - Implementation: `src/contexts/AuthContext.tsx`
  - Methods: `signInWithPassword`, `signUp`, `signOut`, `getUser`, `getSession`, `onAuthStateChange`
  - Session storage: `localStorage` with `persistSession: true`, `autoRefreshToken: true`
  - User invite flow: token-based invite acceptance at `/aceitar-convite` (`src/pages/AceitarConvite.tsx`)
  - Email redirect on signup: `window.location.origin`

**Authorization:**
- Custom RBAC via `user_roles` table (not Supabase built-in roles)
- Roles: `admin`, `supervisor`, `atendente`, `visualizador`
- Admin check: role `admin` with `bot_id = null` means global admin (`src/contexts/AuthContext.tsx:46`)
- Bot-level access: `canAccessBot(botId)` — checks if user has any role for that specific bot
- Route protection: `src/components/auth/ProtectedRoute.tsx` wraps all authenticated routes

## Monitoring & Observability

**Error Tracking:**
- None detected — no Sentry, Datadog, or similar service integrated

**Logs:**
- `console.log` / `console.error` / `console.warn` throughout `src/lib/api.ts`; no structured logging framework
- Supabase Edge Function logs available via Supabase dashboard

## CI/CD & Deployment

**Hosting:**
- Platform: Not explicitly configured in repo; built output is static SPA (`dist/`) suitable for Vercel, Netlify, or any static host
- Lovable platform integration detected (`lovable-tagger` devDependency; `componentTagger` in `vite.config.ts` dev mode) — suggests project may be hosted/deployed via Lovable

**CI Pipeline:**
- None detected in repo (no `.github/`, `.gitlab-ci.yml`, or similar)

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL` — Supabase project REST/realtime URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key (safe to expose in browser)

**Supabase Edge Function secrets (set in Supabase dashboard, not `.env`):**
- `GCP_CREDENTIALS` — Full GCP service account JSON with `client_email`, `private_key`, `project_id`

**Secrets location:**
- `.env` file at repo root (not committed; contents not read)
- GCP credentials: Supabase project secrets panel (referenced as `Deno.env.get('GCP_CREDENTIALS')`)

**Security note:**
- Z-API `Client-Token` value is hardcoded in `src/lib/api.ts` across multiple fetch calls. This is a static client-level token for the Z-API platform (not a per-instance secret) but should be moved to an environment variable.

## Webhooks & Callbacks

**Incoming (from external services into this app):**
- Supabase Realtime — WebSocket subscription for live database changes (`src/pages/Atendimentos.tsx`)
  - Channel `chat-aberto-{chatId}`: listens for `INSERT` on `messages` filtered by `chat_id` — updates open chat in real time
  - Channel `atualiza-sidebar`: listens for all `INSERT` on `messages` — updates sidebar conversation list order and last message preview
  - Channel in `src/pages/Crm.tsx`: listens for chat status changes

**Outgoing (from this app to external services):**
- Z-API REST API — message dispatch on every agent message send (`src/lib/api.ts:sendMessage`)
- Supabase Edge Functions — invoked via `supabase.functions.invoke()` for GCP file operations:
  - `upload-gcp-pdf` — triggered on PDF upload in `src/pages/Treinamento.tsx`
  - `generate-signed-url` — triggered on secure PDF view in `src/pages/Treinamento.tsx`
- Google OAuth2 token endpoint — called from within the `generate-signed-url` Edge Function to obtain GCP access tokens

---

*Integration audit: 2026-04-29*

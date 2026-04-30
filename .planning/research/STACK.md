# Technology Stack

**Project:** Kisabot — WhatsApp AI Customer Service Platform
**Researched:** 2026-04-29
**Question:** Standard 2025/2026 stack for WhatsApp AI customer service at scale (50–200 concurrent conversations)

---

## Recommended Stack

### Core Orchestration: n8n Self-Hosted (Queue Mode)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| n8n | latest stable | Workflow orchestration | Already in use; queue mode unlocks horizontal scaling |
| Redis | 7 (Alpine) | Job broker for queue mode | Required by n8n queue mode; lightweight, battle-tested |
| PostgreSQL | 16 (Alpine) | Shared n8n execution store | Required in queue mode — SQLite is explicitly unsupported |

**Queue Mode is the critical architectural change for reaching 50–200 concurrent conversations.**

In queue mode, the main n8n process handles scheduling and the UI; Redis holds the job queue; multiple worker processes pull and execute workflows independently. This unlocks horizontal scaling: add workers without touching the main process.

**Key environment variables (must be identical on main and every worker):**

```env
EXECUTIONS_MODE=queue
QUEUE_BULL_REDIS_HOST=redis
QUEUE_BULL_REDIS_PORT=6379
QUEUE_BULL_JOB_OPTIONS_REMOVE_ON_COMPLETE=1000
N8N_ENCRYPTION_KEY=<byte-identical across all instances>
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=<password>
N8N_GRACEFUL_SHUTDOWN_TIMEOUT=30
```

**Main process only:**

```env
N8N_HOST=automation.example.com
WEBHOOK_URL=https://automation.example.com/
N8N_PROXY_HOPS=1
```

**Worker startup command:**

```bash
n8n worker --concurrency=10
```

**Scaling formula:** `workers × concurrency ≈ 2× expected peak concurrent executions`

For 50–200 concurrent conversations (I/O-heavy, mostly API calls to Supabase + Vertex AI):
- Concurrency per worker: 10–20 (I/O-heavy workloads)
- Workers needed for 200 concurrent: 2–4 workers at concurrency=20, or 4–8 workers at concurrency=10
- Recommended starting point: 3 workers × concurrency=15 = 45 slots; scale to 4–6 as volume grows

**Docker Compose services:**

```yaml
services:
  postgres:    # PostgreSQL 16-alpine, shared execution store
  redis:       # Redis 7-alpine, appendonly yes (persistence required)
  n8n-main:    # Exposes port 5678; manages UI + webhook ingestion
  n8n-worker:  # No exposed ports; deploy: replicas: 3
```

Scale workers horizontally: `docker compose up -d --scale n8n-worker=4`

**Binary data critical note:** Do NOT share a filesystem mount for binary data between editor and workers — it leads to corruption. Use Google Cloud Storage (already in Kisabot's stack) for all binary/file passing between workflow steps.

**Resource sizing:**

| Target | vCPU | RAM |
|--------|------|-----|
| 50 concurrent | 4 | 8 GB |
| 200 concurrent | 8+ | 16+ GB |

**Confidence:** HIGH — sourced from n8n official docs and multiple production deployment guides.

---

### AI Model: Google Vertex AI (Gemini)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vertex AI Gemini | gemini-2.5-flash | Text generation + Vision | Existing; natively multimodal, no separate vision model needed |

**Image processing (Gemini Vision) via n8n HTTP node:**

There is no dedicated n8n Gemini Vision node as of early 2026. The correct approach is the HTTP Request node hitting the Vertex AI generateContent endpoint directly.

**Vertex AI Gemini Vision endpoint:**

```
POST https://aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL_ID}:generateContent
```

**Request body structure for image input:**

```json
{
  "contents": {
    "role": "USER",
    "parts": [
      {
        "inlineData": {
          "data": "{{BASE64_IMAGE_DATA}}",
          "mimeType": "image/jpeg"
        }
      },
      {
        "text": "Descreva o que está nesta imagem."
      }
    ]
  }
}
```

**Supported mimeTypes:** `image/png`, `image/jpeg`, `image/webp`, `image/heic`, `image/heif`

**Authentication:** Bearer token from GCP service account (see Credential Management section below).

**n8n workflow pattern for incoming WhatsApp image:**

1. Webhook receives Z-API payload containing `mediaUrl` (image URL or base64)
2. HTTP Request node fetches image binary if URL-based
3. Convert to Base64 node (n8n built-in expression: `{{ $binary.data.toString('base64') }}`)
4. HTTP Request node → Vertex AI generateContent endpoint with inlineData
5. Extract text from response → send to AI Agent for reply generation

**Confidence:** HIGH — sourced from Google Cloud official documentation.

---

### TTS (Audio Response): Google Cloud Text-to-Speech

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Google Cloud TTS | v1 REST | Convert AI text replies to audio (OGG/OPUS for WhatsApp) | Already on GCP; no new vendor; WhatsApp requires OGG OPUS for voice messages |

**REST endpoint:**

```
POST https://texttospeech.googleapis.com/v1/text:synthesize
Authorization: Bearer <GCP_ACCESS_TOKEN>
Content-Type: application/json
```

**Request body:**

```json
{
  "input": { "text": "Texto da resposta do agente" },
  "voice": {
    "languageCode": "pt-BR",
    "name": "pt-BR-Wavenet-A",
    "ssmlGender": "FEMALE"
  },
  "audioConfig": {
    "audioEncoding": "OGG_OPUS"
  }
}
```

**Response:** `{ "audioContent": "<base64-encoded-OGG-OPUS-bytes>" }`

**n8n workflow pattern for TTS → WhatsApp audio:**

1. AI Agent generates text reply
2. HTTP Request node → Google TTS API with `audioEncoding: "OGG_OPUS"`
3. Response contains `audioContent` (base64 string)
4. Convert Base64 to Binary node → creates binary file (`audio.ogg`)
5. Upload binary to GCS bucket (temp path) → get signed URL
6. Z-API `POST /send-audio` with the GCS signed URL (or pass binary directly if Z-API supports multipart)

**Alternative to signed URL:** Z-API's `/send-audio` endpoint accepts a `audio` URL parameter. Upload the OGG file to GCS, generate a short-lived signed URL (5 minutes), pass it to Z-API. The file can be deleted after delivery confirmation.

**Voice selection:** `pt-BR-Wavenet-D` (male) or `pt-BR-Wavenet-A` (female) are the highest-quality pt-BR voices. WaveNet voices cost ~4× Studio voices but sound significantly more natural for customer-facing interactions.

**Confidence:** HIGH — sourced from Google Cloud official REST reference.

---

### Credential Management: GCP Service Account (n8n)

**Problem:** GCP OAuth2 tokens in n8n expire every 7 days when the Google OAuth app is in "Testing" mode. This is the root cause of the recurring credential failures in production.

**Solution (HIGH confidence):** Replace all Google OAuth2 credentials in n8n with Google Service Account credentials.

Service account tokens:
- Do not expire as long as the service account remains active
- Are purpose-built for backend automation (not user-facing OAuth flows)
- Bypass the 7-day Google verification/testing mode limitation

**Setup steps:**

1. In GCP Console → IAM & Admin → Service Accounts → Create Service Account
2. Grant required roles: `Vertex AI User`, `Cloud Text-to-Speech API User`, `Storage Object Admin` (for GCS bucket)
3. Create and download JSON key file
4. In n8n → Credentials → Google Service Account → paste entire JSON key content
5. Update all Google-connected nodes in n8n workflows to use this credential

**For existing Supabase Edge Functions:** The `GCP_CREDENTIALS` secret is already stored as service account JSON in Supabase secrets — this is the correct pattern. Apply the same approach inside n8n credentials.

**Token refresh monitoring:** If using OAuth2 anywhere (not recommended), add an n8n Error Trigger workflow that catches credential errors (HTTP 401/403) and sends a Slack/webhook alert. With service accounts, this monitoring can focus on quota exhaustion instead.

**Confidence:** HIGH — sourced from n8n official docs, GCP documentation, and verified community production deployments.

---

### Frontend: React 18 + TanStack Query v5

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 18.3 | UI | Existing; no change |
| TanStack React Query | 5.83 | Server state management | Already installed; currently unused — migration eliminates manual useState/useEffect fetch patterns |
| Supabase JS | 2.91 | DB client + Realtime | Existing; singleton pattern required |

**Current problem:** React Query is installed but not used. All data fetching uses `useState` + `useEffect` patterns that cause stale data, redundant re-fetches, and duplicate Supabase client instances.

**Migration strategy: useQuery for all Supabase reads**

```typescript
// BEFORE (current pattern — problematic)
const [chats, setChats] = useState([]);
useEffect(() => {
  supabase.from('chats').select('*').then(({ data }) => setChats(data));
}, [botId]);

// AFTER (React Query v5 — correct)
const { data: chats, isPending } = useQuery({
  queryKey: ['chats', botId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('bot_id', botId)
      .throwOnError();
    return data;
  },
});
```

**Critical: always call `.throwOnError()`** — without it, Supabase returns errors in the response object. React Query won't detect them, leaving `error` state empty while `data` is undefined.

**Realtime + React Query integration pattern:**

Supabase Realtime broadcasts change events (not full snapshots). The correct pattern is to use Realtime subscriptions to invalidate React Query cache keys, triggering a re-fetch:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('chats-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' },
      () => queryClient.invalidateQueries({ queryKey: ['chats', botId] })
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [botId, queryClient]);
```

This pattern replaces both the duplicated Supabase client issue and the manual `useState` realtime updates.

**v5 breaking changes to know:**
- `isLoading` renamed to `isPending`
- `onSuccess`/`onError` callbacks removed from `useQuery` (still available in `useMutation`)
- Use `useEffect` to react to query state changes for side effects
- Single object parameter API (no overloads)

**Supabase client consolidation:** The dual client problem (`src/integrations/supabase/client.ts` + `src/lib/supabase.ts`) must be resolved before React Query migration. Pick `src/integrations/supabase/client.ts` (typed, has RLS policies baked in) as the single source. Delete `src/lib/supabase.ts` and update all imports in `src/pages/Atendimentos.tsx`.

**Confidence:** HIGH — sourced from TanStack official v5 docs and Supabase + React Query community guides.

---

### WhatsApp Gateway: Z-API

| Technology | Purpose | Status |
|------------|---------|--------|
| Z-API | WhatsApp Business API | Existing; no change recommended |

**Security fix required (before next deploy):**
The Z-API `Client-Token` is hardcoded in `src/lib/api.ts`. Move it to `VITE_SUPABASE_ANON_KEY` scope (not viable — it's a server secret) or better: proxy all Z-API calls through a Supabase Edge Function that reads the token from Supabase secrets. This prevents the token from appearing in the browser bundle.

**Pattern:** Client → `supabase.functions.invoke('zapi-proxy', { body: { action, payload } })` → Edge Function reads `Deno.env.get('ZAPI_CLIENT_TOKEN')` → Z-API REST API.

**Confidence:** MEDIUM — standard security pattern; Z-API docs confirm the Client-Token is a platform-level credential that should not be public.

---

### Monitoring: Prometheus + Grafana (or Uptime Kuma for simpler setup)

| Option | Complexity | Best For |
|--------|------------|----------|
| Uptime Kuma | Low | Basic uptime + webhook/Slack alerts on n8n credential failures |
| Prometheus + Grafana | High | Queue depth, worker throughput, execution latency dashboards |

**Recommended for current scale (50–200 conversations):** Start with Uptime Kuma. It can monitor the n8n health endpoint (`/healthz`), trigger Slack/webhook alerts on downtime, and is deployable as a single Docker container alongside the n8n stack.

For queue depth monitoring, add a lightweight n8n schedule workflow that checks Redis queue length via `redis-cli llen bull:jobs:wait` and alerts if it exceeds threshold (e.g., >50 waiting jobs).

**Confidence:** MEDIUM — based on common self-hosted n8n production patterns.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| n8n scaling | Queue mode + Redis + workers | n8n Cloud | PROJECT.md constraint: must remain self-hosted |
| n8n scaling | Queue mode + Redis | Single instance + higher CPU | Single instance has hard concurrency ceiling; no horizontal scale path |
| TTS | Google Cloud TTS | ElevenLabs | ElevenLabs is higher quality but adds new vendor/credentials; GCP already integrated |
| TTS | Google Cloud TTS | OpenAI TTS | Same cost profile; switching AI vendor contradicts project constraint |
| Image analysis | Gemini via HTTP node | Dedicated vision service | Gemini is already the primary model; native multimodal avoids latency of separate service |
| Credential fix | Service Account JSON | Publish OAuth app | Publishing Google OAuth app requires weeks of verification; service account is immediate |
| Frontend state | React Query v5 | Zustand | PROJECT.md Out of Scope: Redux/Zustand explicitly excluded |
| Z-API proxy | Supabase Edge Function | Move token to .env | VITE_ prefixed vars are bundled into client JS; still public. Edge function is the correct server-side pattern |

---

## Installation

No new npm packages required — TanStack React Query v5 (`@tanstack/react-query` 5.83) is already in `package.json` and `package-lock.json`. React Query `QueryClientProvider` is already wrapping the app in `src/App.tsx`.

For n8n infrastructure additions:

```bash
# Add to docker-compose.yml
# - redis:7-alpine service
# - postgres:16-alpine service (if not already using external Postgres)
# - n8n-worker service with n8n worker --concurrency=10
```

---

## Sources

- n8n Queue Mode official docs: https://docs.n8n.io/hosting/scaling/queue-mode/
- n8n concurrency control: https://docs.n8n.io/hosting/scaling/concurrency-control/
- n8n queue mode production guide (LumaDock): https://lumadock.com/tutorials/n8n-queue-mode-redis-workers
- n8n queue mode scaling (Elestio): https://blog.elest.io/how-to-scale-n8n-with-redis-queue-mode-for-parallel-workflow-execution/
- Google Cloud TTS REST reference: https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize
- Vertex AI Gemini image understanding: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-understanding
- Vertex AI Gemini inference reference: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference
- GCP service account credential fix for n8n: https://ignite-ops.com/resources/2025/03/google-oauth-n8n-keeps-expiring-here-is-the-real-fix/
- TanStack Query v5 migration guide: https://tanstack.com/query/v5/docs/react/guides/migrating-to-v5
- Supabase + React Query integration: https://makerkit.dev/blog/saas/supabase-react-query
- n8n Gemini multimodal community thread: https://community.n8n.io/t/node-gemini-multimodal-genai-vertex-ai/43140

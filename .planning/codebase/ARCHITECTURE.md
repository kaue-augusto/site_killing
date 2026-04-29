<!-- refreshed: 2026-04-29 -->
# Architecture

**Analysis Date:** 2026-04-29

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         React SPA (Browser)                          │
│  `src/main.tsx` → `src/App.tsx`                                      │
├────────────────┬───────────────────┬────────────────────────────────┤
│  Provider Layer│  Routing Layer    │   Layout Layer                  │
│  `AuthContext` │  React Router     │   `MainLayout`                  │
│  `BotContext`  │  `App.tsx`        │   `AppSidebar` + `TopBar`       │
│  React Query   │                   │   `ProtectedRoute`              │
└───────┬────────┴────────┬──────────┴──────────────┬─────────────────┘
        │                 │                          │
        ▼                 ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Pages Layer                                  │
│  `src/pages/Atendimentos.tsx`   `src/pages/Dashboard.tsx`            │
│  `src/pages/Treinamento.tsx`    `src/pages/Configuracoes.tsx`        │
│  `src/pages/Contatos.tsx`       `src/pages/Crm.tsx`                  │
│  `src/pages/MinhaConta.tsx`     `src/pages/Login.tsx`                │
│  `src/pages/AceitarConvite.tsx` `src/pages/Index.tsx`                │
└───────┬─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API / Service Layer                              │
│  `src/lib/api.ts`  — all Supabase DB queries + Z-API HTTP calls      │
└───────┬─────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────┬──────────────────────────────────────────────┐
│  Supabase (backend)  │  External APIs                                │
│  Auth, DB, Realtime  │  Z-API (WhatsApp)                             │
│  Edge Functions      │  Google Cloud Storage (PDF upload)            │
│  `integrations/      │                                               │
│   supabase/`         │                                               │
└──────────────────────┴──────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` | Root provider composition, routing tree | `src/App.tsx` |
| `AuthContext` | Supabase session, user profile, roles/permissions | `src/contexts/AuthContext.tsx` |
| `BotContext` | Active bot list, selected bot, per-user bot preference | `src/contexts/BotContext.tsx` |
| `ProtectedRoute` | Redirect to `/login` if unauthenticated; admin/bot-access guards | `src/components/auth/ProtectedRoute.tsx` |
| `MainLayout` | Shell: sidebar + topbar + `<main>` content area | `src/components/layout/MainLayout.tsx` |
| `AppSidebar` | Collapsible nav with role-aware menu items | `src/components/layout/AppSidebar.tsx` |
| `Atendimentos` | WhatsApp conversation inbox; owns realtime subscriptions for messages and sidebar | `src/pages/Atendimentos.tsx` |
| `ConversationList` | Renders conversation list panel within `Atendimentos` | `src/components/atendimentos/ConversationList.tsx` |
| `ChatWindow` | Message thread display + send UI | `src/components/atendimentos/ChatWindow.tsx` |
| `ContactPanel` | Slide-over contact details panel | `src/components/atendimentos/ContactPanel.tsx` |
| `Dashboard` | Analytics charts (Recharts) fed by `fetchDashboard` | `src/pages/Dashboard.tsx` |
| `Treinamento` | Bot configuration, mode selection, WhatsApp QR pairing, PDF upload | `src/pages/Treinamento.tsx` |
| `Configuracoes` | User/team management, invite system, role assignment | `src/pages/Configuracoes.tsx` |
| `Crm` | Kanban/list lead pipeline with drag-and-drop (`@hello-pangea/dnd`) | `src/pages/Crm.tsx` |
| `api.ts` | All database access and external HTTP calls; no React dependencies | `src/lib/api.ts` |
| Supabase client | Singleton typed client; session persisted in `localStorage` | `src/integrations/supabase/client.ts` |

## Pattern Overview

**Overall:** Client-Side Single-Page Application with Context-Driven State

**Key Characteristics:**
- No dedicated state management library (Redux, Zustand); global state lives in React Context (`AuthContext`, `BotContext`)
- All data access is centralised in `src/lib/api.ts` — pages call its exported functions rather than querying Supabase directly (except `Atendimentos.tsx` and `Treinamento.tsx` which import the Supabase client directly for realtime subscriptions and minor queries)
- `@tanstack/react-query` is wired as `QueryClientProvider` in `App.tsx` but is not yet used in pages — pages manage loading state with local `useState`/`useEffect`
- UI components are Radix-UI-based (shadcn/ui), all in `src/components/ui/`

## Layers

**Provider / Context Layer:**
- Purpose: Global authentication state, selected-bot preference, UI providers
- Location: `src/contexts/`
- Contains: `AuthContext.tsx`, `BotContext.tsx`
- Depends on: `src/integrations/supabase/client.ts`
- Used by: All pages, layout components

**Routing Layer:**
- Purpose: Declarative route tree; applies `ProtectedRoute` and `MainLayout` wrappers
- Location: `src/App.tsx`
- Contains: Route definitions, provider composition
- Depends on: `react-router-dom`, all page components
- Used by: `src/main.tsx`

**Layout Layer:**
- Purpose: Persistent shell chrome; sidebar navigation, top bar with bot selector
- Location: `src/components/layout/`
- Contains: `MainLayout.tsx`, `AppSidebar.tsx`, `TopBar.tsx`
- Depends on: `AuthContext`, `BotContext`, UI components
- Used by: Every protected page via `App.tsx`

**Pages Layer:**
- Purpose: Feature screens; own local state, side-effects, and presentation logic
- Location: `src/pages/`
- Contains: One file per route
- Depends on: `src/lib/api.ts`, contexts, `src/components/atendimentos/`, UI components
- Used by: Routing layer

**Feature Components Layer:**
- Purpose: Reusable multi-part components for the Atendimentos feature
- Location: `src/components/atendimentos/`
- Contains: `ConversationList.tsx`, `ChatWindow.tsx`, `ContactPanel.tsx`
- Depends on: Types from `src/lib/api.ts`, UI components
- Used by: `src/pages/Atendimentos.tsx`

**Service / API Layer:**
- Purpose: All database queries and external HTTP calls; stateless functions
- Location: `src/lib/api.ts`
- Contains: Exported async functions for conversations, messages, contacts, bots, Z-API, GCP
- Depends on: `src/integrations/supabase/client.ts`
- Used by: Pages layer

**Supabase Integration Layer:**
- Purpose: Typed Supabase client singleton and generated database types
- Location: `src/integrations/supabase/`
- Contains: `client.ts`, `types.ts`
- Depends on: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` env vars
- Used by: `src/lib/api.ts`, `src/contexts/`, some pages

**Edge Functions Layer:**
- Purpose: Server-side tasks requiring secrets (GCP credentials, signed URLs)
- Location: `supabase/functions/`
- Contains: `upload-gcp-pdf/index.ts`, `generate-signed-url/index.ts`
- Runtime: Deno on Supabase Edge Runtime
- Invoked by: `src/lib/api.ts` via `supabase.functions.invoke()`

## Data Flow

### Primary Request Path — Loading Conversation Messages

1. User selects a bot in `TopBar` → `BotContext.setSelectedBot()` updates `selectedBot` state
2. `Atendimentos.tsx` `useEffect([selectedBot])` fires → calls `fetchConversations(selectedBot.slug)` (`src/lib/api.ts:95`)
3. `api.ts` queries Supabase: `bots` table for bot ID, then `chats` table filtered by `bot_id`, then `messages` for latest per chat
4. Conversations stored in `useState<Conversation[]>` in `Atendimentos.tsx`
5. User clicks a conversation → `handleSelectConversation` updates `selectedConversation` state
6. Second `useEffect([selectedConversation])` fires → calls `fetchMessages(conversationId)` (`src/lib/api.ts:166`)
7. Messages stored in `useState<Message[]>` → passed as prop to `<ChatWindow>`

### Sending a Message

1. Agent types in `ChatWindow` → calls `onSendMessage(content, type)` prop callback
2. `Atendimentos.tsx:handleSendMessage` calls `sendMessage()` from `src/lib/api.ts:196`
3. `api.ts` inserts row into `messages` table (Supabase)
4. `api.ts` fetches `contact_phone` + `zapi_instance`/`zap_token` from `chats`/`bots` tables
5. `api.ts` dispatches HTTP POST to `https://api.z-api.io/instances/{id}/token/{token}/{endpoint}`
6. Returned `Message` object is optimistically appended to local `messages` state

### Realtime Updates

1. `Atendimentos.tsx` opens Supabase Realtime channel `chat-aberto-{id}` filtering `messages INSERT` for the active chat (`src/pages/Atendimentos.tsx:86`)
2. New messages pushed from Supabase → appended to `messages` state (deduplication by ID)
3. A second channel `atualiza-sidebar` listens to ALL `messages INSERT` events → updates `lastMessage` and re-sorts `conversations` list (`src/pages/Atendimentos.tsx:152`)
4. Both channels are torn down on `useEffect` cleanup

### PDF Upload to GCP

1. User selects a PDF in `Treinamento.tsx` → calls `uploadPdfToGCP(file, botId)` (`src/lib/api.ts:639`)
2. `api.ts` invokes Supabase Edge Function `upload-gcp-pdf` with `FormData`
3. Edge Function (`supabase/functions/upload-gcp-pdf/index.ts`) uploads to Google Cloud Storage using `GCP_CREDENTIALS` secret
4. `api.ts` inserts file metadata into `arquivos_bot` table
5. Returns `{ id, name, size, url }` to page component

**State Management:**
- Authentication/session: `AuthContext` (React Context + Supabase `onAuthStateChange`)
- Selected bot: `BotContext` (React Context; preference persisted to `profiles.selected_bot_id`)
- Conversation/message lists: Local `useState` inside `Atendimentos.tsx`
- Server cache: Not used (`React Query` is wired but unused in practice)
- No global client-side store (Redux/Zustand/Jotai)

## Key Abstractions

**`Conversation`:**
- Purpose: Normalized view of a `chats` DB row with computed `lastMessage`, `unreadCount`, typed `status`
- Definition: `src/lib/api.ts:6`
- Used by: `Atendimentos.tsx`, `ConversationList.tsx`, `ChatWindow.tsx`, `ContactPanel.tsx`

**`Message`:**
- Purpose: Normalized view of a `messages` DB row; supports text, image, audio, document, pdf types
- Definition: `src/lib/api.ts:31`
- Used by: `Atendimentos.tsx`, `ChatWindow.tsx`

**`Bot`:**
- Purpose: Represents a configured WhatsApp bot with Z-API credentials, training instructions, mode
- Definition: `src/types/bot.ts:1`
- Used by: `BotContext`, `Treinamento.tsx`, `Configuracoes.tsx`

**`AppRole`:**
- Purpose: RBAC roles (`admin`, `supervisor`, `atendente`, `visualizador`) enforced at route and UI level
- Definition: `src/contexts/AuthContext.tsx:5`
- Used by: `AuthContext`, `ProtectedRoute`, `Configuracoes.tsx`, `AceitarConvite.tsx`

## Entry Points

**Application Bootstrap:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html`, Vite bundles `main.tsx`
- Responsibilities: Creates React root, mounts `<App />`, sets document title to "Kisabot"

**Public Routes:**
- `/login` → `src/pages/Login.tsx` — Supabase email/password sign-in
- `/aceitar-convite` → `src/pages/AceitarConvite.tsx` — Token-based invite acceptance with account creation

**Protected Routes (all wrapped in `ProtectedRoute` + `MainLayout`):**
- `/` → `src/pages/Index.tsx` (redirects to Atendimentos)
- `/dashboard` → `src/pages/Dashboard.tsx`
- `/contatos` → `src/pages/Contatos.tsx`
- `/conta` → `src/pages/MinhaConta.tsx`
- `/treinamento` → `src/pages/Treinamento.tsx`
- `/suporte` → `src/pages/CentralSucesso.tsx`
- `/crm` → `src/pages/Crm.tsx`
- `/configuracoes` → `src/pages/Configuracoes.tsx`

**Edge Function Entry Points:**
- `supabase/functions/upload-gcp-pdf/index.ts` — Deno HTTP handler for PDF upload
- `supabase/functions/generate-signed-url/index.ts` — Deno HTTP handler for signed GCS URL generation

## Architectural Constraints

- **Threading:** Single-threaded browser event loop; no Web Workers
- **Global state:** Two module-level singletons — `supabase` client (`src/integrations/supabase/client.ts`) and `queryClient` (`src/App.tsx`). All other state is component-scoped
- **Circular imports:** `BotContext` imports `AuthContext` (`useAuth`); `AuthContext` has no upward imports — no circular chain
- **Import alias:** `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`)
- **Mixed client imports:** Some pages import Supabase from `@/lib/supabase` (a non-existent alias at `src/lib/supabase`) rather than the canonical `@/integrations/supabase/client`. This will cause build errors — see CONCERNS.md

## Anti-Patterns

### Direct Supabase Client Use in Pages

**What happens:** `Atendimentos.tsx` and `Treinamento.tsx` import the Supabase client directly to make DB queries and open Realtime channels, bypassing `src/lib/api.ts`
**Why it's wrong:** Splits data access across two locations; makes it difficult to trace all DB interactions; inconsistent with the established service layer
**Do this instead:** Move all Supabase queries and channel subscriptions into `src/lib/api.ts` or a dedicated hooks file (e.g., `src/hooks/useConversations.ts`), and call those from page components

### Unused React Query

**What happens:** `QueryClientProvider` wraps the entire app (`src/App.tsx:4,22`) but no page uses `useQuery`/`useMutation`
**Why it's wrong:** Pages reimplement loading/error state manually with `useState` + `useEffect`; no caching, deduplication, or background refetch
**Do this instead:** Migrate `fetchConversations`, `fetchMessages`, and `fetchDashboard` calls to `useQuery` hooks; use `useMutation` for `sendMessage`, `closeConversation`, etc.

### Hardcoded API Token in Source

**What happens:** The Z-API `Client-Token` header value `F24b2619953344130ba2eaf6d576dddceS` is hardcoded as a string literal in `src/lib/api.ts` (lines 277, 564, 610, 632)
**Why it's wrong:** Secret is committed to version control and will appear in the compiled JS bundle served to all users
**Do this instead:** Move the token to a Supabase Edge Function or an environment variable read server-side; never embed credentials in client JS

## Error Handling

**Strategy:** Try/catch in page `useEffect` handlers with `toast` notifications on failure; `api.ts` functions return empty arrays on fetch errors and throw on mutation errors

**Patterns:**
- Fetch errors: Caught in page `useEffect`, display destructive toast via `@/hooks/use-toast` or `sonner`
- Mutation errors: `api.ts` throws, caller wraps in try/catch and shows toast
- Auth errors: `ProtectedRoute` redirects to `/login`; `AuthContext` methods return `{ error }` objects
- Edge Function errors: Checked via `if (error) throw new Error(error.message)`

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.error` with emoji prefixes throughout `src/lib/api.ts` (e.g., `"🔍 1. Tentando buscar..."`) — no structured logger
**Validation:** No frontend form validation library; basic checks with `if (!value)` guards
**Authentication:** Supabase Auth with `localStorage` session persistence; RBAC enforced via `AuthContext.isAdmin` / `canAccessBot()` and `ProtectedRoute` guards

---

*Architecture analysis: 2026-04-29*

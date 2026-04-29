# Codebase Structure

**Analysis Date:** 2026-04-29

## Directory Layout

```
site_killing/
├── src/                        # All application source code
│   ├── main.tsx                # React app bootstrap; sets document.title
│   ├── App.tsx                 # Provider composition + route tree
│   ├── App.css                 # Global overrides (minimal)
│   ├── index.css               # Tailwind base + CSS custom properties
│   ├── vite-env.d.ts           # Vite type declarations
│   │
│   ├── pages/                  # One file per route — full-page feature screens
│   │   ├── Index.tsx           # `/` — entry redirect
│   │   ├── Login.tsx           # `/login` — public auth screen
│   │   ├── AceitarConvite.tsx  # `/aceitar-convite` — invite token flow
│   │   ├── Atendimentos.tsx    # `/` (main) — WhatsApp inbox + realtime
│   │   ├── Dashboard.tsx       # `/dashboard` — analytics + charts
│   │   ├── Contatos.tsx        # `/contatos` — contact list
│   │   ├── Crm.tsx             # `/crm` — kanban lead pipeline
│   │   ├── Treinamento.tsx     # `/treinamento` — bot config + QR + PDF
│   │   ├── Configuracoes.tsx   # `/configuracoes` — user/team/role management
│   │   ├── MinhaConta.tsx      # `/conta` — profile settings
│   │   ├── CentralSucesso.tsx  # `/suporte` — help centre
│   │   └── NotFound.tsx        # `*` — 404 page
│   │
│   ├── components/
│   │   ├── atendimentos/       # Feature components for the inbox screen
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   └── ContactPanel.tsx
│   │   ├── layout/             # Persistent shell chrome
│   │   │   ├── MainLayout.tsx
│   │   │   ├── AppSidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx
│   │   ├── NavLink.tsx         # Router-aware link with active styling
│   │   └── ui/                 # shadcn/ui primitives (Radix-based, ~40 files)
│   │
│   ├── contexts/               # React Context providers
│   │   ├── AuthContext.tsx     # Auth state, user profile, RBAC roles
│   │   └── BotContext.tsx      # Bot list, selected bot, per-user preference
│   │
│   ├── hooks/                  # Shared custom hooks
│   │   ├── use-mobile.tsx      # Breakpoint detection hook
│   │   └── use-toast.ts        # Toast notification hook
│   │
│   ├── lib/
│   │   └── api.ts              # All Supabase queries + Z-API HTTP calls
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts       # Typed Supabase singleton (auto-generated)
│   │       └── types.ts        # Full DB type definitions (auto-generated)
│   │
│   ├── types/
│   │   └── bot.ts              # `Bot`, `WhatsAppConnection`, `WhatsAppConnectionLog`
│   │
│   └── test/                   # Test utilities / setup files
│
├── supabase/                   # Supabase project configuration
│   ├── functions/
│   │   ├── upload-gcp-pdf/     # Edge Function: upload PDF to Google Cloud Storage
│   │   │   ├── index.ts
│   │   │   └── deno.json
│   │   └── generate-signed-url/# Edge Function: generate signed GCS download URL
│   │       ├── index.ts
│   │       └── deno.json
│   ├── migrations/             # SQL migration files (3 applied)
│   └── .temp/                  # Supabase CLI temp files (not committed)
│
├── public/                     # Static assets served at root
├── dist/                       # Vite build output (not committed to source)
├── atendimento1-main/          # Stale copy of earlier codebase version (unused)
├── check_chats.cjs             # Standalone Node debug script
├── check_messages.cjs          # Standalone Node debug script
├── index.html                  # Vite HTML entry point
├── vite.config.ts              # Vite config; `@/` alias; port 8080
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript project references root
├── tsconfig.app.json           # App tsconfig (`@/` path alias defined here)
├── tsconfig.node.json          # Node/Vite tooling tsconfig
├── eslint.config.js            # ESLint flat config
├── postcss.config.js           # PostCSS config (Tailwind + Autoprefixer)
├── components.json             # shadcn/ui component registry config
├── vitest.config.ts            # Vitest test runner config
├── package.json
├── package-lock.json
└── bun.lockb                   # Bun lockfile (project uses both npm and bun)
```

## Directory Purposes

**`src/pages/`:**
- Purpose: One React component per application route; orchestrates data fetching and local state
- Contains: Feature screens; each file is a default export React component
- Key files: `src/pages/Atendimentos.tsx` (core inbox), `src/pages/Treinamento.tsx` (bot setup), `src/pages/Configuracoes.tsx` (admin panel)

**`src/components/atendimentos/`:**
- Purpose: Sub-components for the WhatsApp inbox feature — split from `Atendimentos.tsx` for size management
- Contains: `ConversationList.tsx`, `ChatWindow.tsx`, `ContactPanel.tsx`
- Used by: `src/pages/Atendimentos.tsx` exclusively

**`src/components/layout/`:**
- Purpose: Persistent application shell rendered around all protected pages
- Contains: `MainLayout.tsx` (wrapper), `AppSidebar.tsx` (collapsible nav), `TopBar.tsx` (header + bot selector)

**`src/components/ui/`:**
- Purpose: Design system primitives from shadcn/ui (Radix UI + Tailwind)
- Contains: ~40 component files (Button, Card, Dialog, Sheet, Tabs, etc.)
- Generated: Partially (via `npx shadcn-ui add`); do NOT hand-edit existing files — add new ones with the CLI

**`src/contexts/`:**
- Purpose: Application-wide React Context providers
- Contains: `AuthContext.tsx` (session + roles), `BotContext.tsx` (bot list + selection)
- Rule: Contexts must not import from `src/lib/api.ts` — they use the Supabase client directly to avoid circular dependencies

**`src/lib/`:**
- Purpose: Service layer — pure async functions for all data operations
- Contains: `api.ts` (all exported API functions)
- Rule: No React imports; no JSX; no side effects on module load

**`src/integrations/supabase/`:**
- Purpose: Auto-generated Supabase client and type bindings
- Contains: `client.ts`, `types.ts`
- Generated: Yes — regenerate with `npx supabase gen types typescript`. Do NOT manually edit `types.ts`

**`src/types/`:**
- Purpose: Shared TypeScript interfaces not tied to a single component
- Contains: `bot.ts` (`Bot`, `WhatsAppConnection`)

**`src/hooks/`:**
- Purpose: Reusable stateful logic extracted from components
- Contains: `use-mobile.tsx`, `use-toast.ts`

**`supabase/functions/`:**
- Purpose: Deno-based Supabase Edge Functions for server-side operations requiring secrets
- Contains: `upload-gcp-pdf/`, `generate-signed-url/`
- Runtime: Deno on Supabase Edge; deploy with `supabase functions deploy`

**`supabase/migrations/`:**
- Purpose: Versioned SQL migrations applied to the Supabase Postgres database
- Generated: Via `supabase migration new`; committed to source control

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM mount point
- `src/App.tsx`: Provider stack and route definitions
- `index.html`: Vite HTML shell

**Configuration:**
- `vite.config.ts`: Build config, dev server (port 8080), `@/` alias
- `tailwind.config.ts`: Theme tokens, content paths
- `tsconfig.app.json`: TypeScript paths — `"@/*": ["./src/*"]`
- `components.json`: shadcn/ui registry (style, base color, alias)
- `supabase/migrations/`: Database schema history

**Core Logic:**
- `src/lib/api.ts`: All database queries and external API calls
- `src/contexts/AuthContext.tsx`: Auth state + RBAC
- `src/contexts/BotContext.tsx`: Bot selection logic
- `src/integrations/supabase/client.ts`: Supabase singleton

**Feature Screens:**
- `src/pages/Atendimentos.tsx`: Primary inbox feature
- `src/pages/Treinamento.tsx`: Bot training + WhatsApp QR setup
- `src/pages/Configuracoes.tsx`: Team management + invite system
- `src/pages/Crm.tsx`: Lead pipeline (drag-and-drop Kanban)

**Edge Functions:**
- `supabase/functions/upload-gcp-pdf/index.ts`
- `supabase/functions/generate-signed-url/index.ts`

## Naming Conventions

**Files:**
- Pages: PascalCase, Portuguese names matching the route concept — `Atendimentos.tsx`, `Treinamento.tsx`, `MinhaConta.tsx`
- Components: PascalCase — `ChatWindow.tsx`, `ConversationList.tsx`, `ProtectedRoute.tsx`
- Hooks: kebab-case with `use-` prefix — `use-toast.ts`, `use-mobile.tsx`
- Utilities/services: camelCase — `api.ts`, `client.ts`
- UI primitives: kebab-case matching shadcn naming — `alert-dialog.tsx`, `dropdown-menu.tsx`

**Directories:**
- Feature component groups: lowercase, plural — `atendimentos/`, `layout/`, `auth/`
- Source groupings: lowercase singular — `pages/`, `contexts/`, `hooks/`, `lib/`, `types/`

**Exported symbols:**
- React components: PascalCase named exports — `export function ChatWindow(...)`, `export default function Atendimentos()`
- Types/interfaces: PascalCase — `Conversation`, `Message`, `Bot`, `AppRole`
- API functions: camelCase — `fetchConversations`, `sendMessage`, `saveBotTraining`
- Context hooks: `use` + PascalCase — `useAuth`, `useBot`

## Where to Add New Code

**New page/route:**
1. Create `src/pages/NewPage.tsx` as a default export component
2. Add the route in `src/App.tsx` inside the `<ProtectedRoute><MainLayout>` wrapper pattern
3. Add a menu entry in `src/components/layout/AppSidebar.tsx` `menuItems` array if it needs nav visibility

**New feature component (sub-components of a page):**
- Create a new directory `src/components/{feature-name}/` with PascalCase component files
- Import into the corresponding page component

**New API function (DB query or external call):**
- Add to `src/lib/api.ts` as a named async export
- Define any new interfaces (input/output types) at the top of the same file or in `src/types/`

**New shared custom hook:**
- Create `src/hooks/use-{name}.ts` or `use-{name}.tsx`
- Follow `use-toast.ts` as a reference pattern

**New shared type:**
- Add to `src/types/bot.ts` if bot-related, or create a new file `src/types/{domain}.ts`

**New UI primitive:**
- Use `npx shadcn-ui add {component}` — do not hand-create files in `src/components/ui/`

**New Supabase Edge Function:**
- Create `supabase/functions/{function-name}/index.ts` and `deno.json`
- Deploy with `supabase functions deploy {function-name}`
- Invoke from `src/lib/api.ts` via `supabase.functions.invoke('{function-name}', { body: ... })`

**New database table/column:**
- Create a migration: `supabase migration new {description}`
- Regenerate types: `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`

## Special Directories

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes
- Committed: No (should be in `.gitignore`)

**`atendimento1-main/`:**
- Purpose: Stale directory — appears to be an earlier copy of the project left in the repo root
- Generated: No
- Committed: Yes (accidentally)
- Action: Should be removed from the repository

**`supabase/.temp/`:**
- Purpose: Supabase CLI temporary files
- Generated: Yes
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents consumed by planning and execution commands
- Generated: By `/gsd-map-codebase`
- Committed: Yes

---

*Structure analysis: 2026-04-29*

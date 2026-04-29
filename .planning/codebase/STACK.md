# Technology Stack

**Analysis Date:** 2026-04-29

## Languages

**Primary:**
- TypeScript 5.8 - All frontend source (`src/**/*.ts`, `src/**/*.tsx`)
- TSX (React JSX) - All UI components and pages (`src/components/`, `src/pages/`)

**Secondary:**
- SQL - Supabase migrations (`supabase/migrations/*.sql`)
- TypeScript/Deno - Supabase Edge Functions (`supabase/functions/**/*.ts`)
- JavaScript (CJS) - Utility scripts at repo root (`check_chats.cjs`, `check_messages.cjs`)

## Runtime

**Environment:**
- Browser (SPA) — primary runtime for the React application
- Deno — runtime for Supabase Edge Functions (`supabase/functions/`)
- Node.js v24 — local development tooling

**Package Manager:**
- npm (primary; `package-lock.json` present)
- bun (`bun.lockb` also present — used by some contributors)
- Lockfile: both `package-lock.json` and `bun.lockb` present (possible divergence risk)

## Frameworks

**Core:**
- React 18.3 — UI rendering (`src/main.tsx`, `src/App.tsx`)
- React Router DOM 6.30 — Client-side routing (`src/App.tsx`)
- TanStack React Query 5.83 — Server state / async data fetching (`src/App.tsx` wraps app in `QueryClientProvider`)

**UI Component System:**
- Radix UI (full suite, ~20+ primitives) — headless accessible components (`src/components/ui/`)
- shadcn/ui component conventions — Radix + Tailwind composition pattern
- Tailwind CSS 3.4 — Utility-first styling (`tailwind.config.ts`)
- tailwindcss-animate — Animation utilities (`tailwind.config.ts` plugins)
- class-variance-authority (CVA) 0.7 — Variant-based component styling
- tailwind-merge 2.6 — Merging Tailwind class strings
- clsx 2.1 — Conditional className helper

**Animation:**
- Framer Motion 12.26 — Page and component animations

**Forms:**
- React Hook Form 7.61 — Form state management
- Zod 3.25 — Schema validation (used with `@hookform/resolvers`)

**Charts/Data Viz:**
- Recharts 2.15 — Dashboard charts (`src/pages/Dashboard.tsx`)

**Drag & Drop:**
- @hello-pangea/dnd 18.0 — Kanban/CRM drag and drop (`src/pages/Crm.tsx`)

**Testing:**
- Vitest 3.2 — Test runner (`vitest.config.ts`)
- @testing-library/react 16.0 — Component testing
- @testing-library/jest-dom 6.6 — DOM matchers
- jsdom 20 — Browser environment simulation for tests

**Build/Dev:**
- Vite 5.4 — Build tool and dev server (`vite.config.ts`, port 8080)
- @vitejs/plugin-react-swc 3.11 — React fast refresh via SWC compiler
- lovable-tagger 1.1 — Dev-mode component tagging (Lovable platform integration)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.91 — Primary database client, auth, realtime, and edge function invocation
- `react-router-dom` 6.30 — All navigation; used in `src/App.tsx`
- `@tanstack/react-query` 5.83 — Data fetching and caching
- `zod` 3.25 — Runtime validation for forms

**Infrastructure:**
- `lucide-react` 0.462 — Icon set used throughout all components
- `sonner` 1.7 — Toast notifications (`src/components/ui/sonner.tsx`, also imported directly in pages)
- `date-fns` 3.6 — Date formatting (timestamps in chat, dashboard)
- `next-themes` 0.3 — Dark/light theme provider
- `react-resizable-panels` 2.1 — Resizable sidebar layout in atendimentos view
- `recharts` 2.15 — Dashboard metrics charts
- `embla-carousel-react` 8.6 — Carousel component
- `framer-motion` 12.26 — Animations
- `react-day-picker` 8.10 — Date picker component
- `vaul` 0.9 — Drawer component
- `cmdk` 1.1 — Command palette

## Configuration

**Environment:**
- Configured via `.env` file (present; contents not read per security policy)
- Required env vars (referenced in source):
  - `VITE_SUPABASE_URL` — Supabase project URL (`src/lib/supabase.ts`, `src/integrations/supabase/client.ts`)
  - `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key (same files)
- Edge function secrets managed via Supabase Secrets panel:
  - `GCP_CREDENTIALS` — Google Cloud service account JSON (`supabase/functions/upload-gcp-pdf/index.ts`, `supabase/functions/generate-signed-url/index.ts`)

**Build:**
- `vite.config.ts` — Vite configuration; dev server on port 8080, path alias `@` → `./src`
- `tsconfig.json` — Root TS config; references `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` — App TS config; target ES2020, strict mode OFF, `noImplicitAny: false`
- `postcss.config.js` — PostCSS with Autoprefixer
- `tailwind.config.ts` — Extended theme with custom chat colors, sidebar tokens, Inter font
- `components.json` — shadcn/ui CLI config for component generation
- `eslint.config.js` — ESLint flat config; typescript-eslint + react-hooks + react-refresh

## Platform Requirements

**Development:**
- Node.js (v18+ recommended; v24 detected on dev machine)
- npm or bun for package management
- Supabase CLI for local edge function development

**Production:**
- Static SPA hosting (any CDN/static host; `dist/` output from `vite build`)
- Supabase hosted project (project ID: `xgkahpgvgkipdkmwwjfl` per `supabase/config.toml`)
- Supabase Edge Functions deployed to the project (2 functions: `upload-gcp-pdf`, `generate-signed-url`)

---

*Stack analysis: 2026-04-29*

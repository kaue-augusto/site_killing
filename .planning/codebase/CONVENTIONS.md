# Coding Conventions

**Analysis Date:** 2026-04-29

## Naming Patterns

**Files:**
- React page components: PascalCase, Portuguese names — `Login.tsx`, `Atendimentos.tsx`, `Configuracoes.tsx`, `MinhaConta.tsx`
- React feature components: PascalCase, English or Portuguese — `ChatWindow.tsx`, `ConversationList.tsx`, `ContactPanel.tsx`
- shadcn/ui primitives: kebab-case — `alert-dialog.tsx`, `dropdown-menu.tsx`, `scroll-area.tsx`
- Custom hooks: camelCase with `use-` prefix — `use-mobile.tsx`, `use-toast.ts`
- Context files: PascalCase with `Context` suffix — `AuthContext.tsx`, `BotContext.tsx`
- Utility files: camelCase — `utils.ts`, `api.ts`
- Type definition files: camelCase — `bot.ts`

**Functions:**
- Named functions exported from context/hooks: camelCase — `useAuth`, `useBot`, `useIsMobile`
- Async API functions: camelCase verb+noun — `fetchConversations`, `sendMessage`, `closeConversation`, `takeoverConversation`
- Event handlers: camelCase `handle` prefix — `handleLogin`, `handleSignup`, `handleSend`, `handleFileChange`
- Utility functions defined inside components: camelCase — `scrollToBottom`, `fileToBase64`, `triggerFileSelect`, `formatWhatsAppDate`

**Variables:**
- State variables: camelCase — `isLoading`, `selectedConversation`, `inputValue`, `isUploading`
- Boolean state: `is` prefix — `isLoading`, `isResizing`, `isUploading`, `isAdmin`, `isActive`
- Constants at module level: camelCase — `mockContacts`, `mockAgent`, `menuItems`, `queryClient`
- Type-derived union strings: lowercase with single quotes — `'open' | 'assigned' | 'closed' | 'pending'`

**Types and Interfaces:**
- Interfaces: PascalCase — `Conversation`, `Message`, `Contact`, `Agent`, `Bot`, `AuthContextType`
- Props interfaces: PascalCase with `Props` suffix — `ChatWindowProps`, `ConversationListProps`, `ButtonProps`
- Type aliases: PascalCase — `BotType`, `FilterType`, `AppRole`
- Database-derived types use `Database` namespace import: `Database['public']['Enums']['app_role']`

**Components (React):**
- All React components: PascalCase — `App`, `Login`, `AuthProvider`, `BotProvider`, `ChatWindow`
- Named exports for feature components: `export function ChatWindow(...)`, `export function AppSidebar()`
- Default exports for page components: `export default function Login()`
- shadcn/ui components: use `forwardRef` with `displayName` set — `Button.displayName = "Button"`

## Code Style

**Formatting:**
- No `.prettierrc` file detected — formatting is not enforced by a config file
- Indentation: 2-space indent throughout all source files
- Trailing commas: present in function arguments and object literals
- Semicolons: present at end of statements
- String quotes: single quotes in `.ts`/`.tsx` files (e.g. `'@/lib/api'`), some double quotes in JSX attribute strings

**Linting:**
- Tool: ESLint 9 with `typescript-eslint` (flat config via `eslint.config.js`)
- React Hooks rules enforced: `eslint-plugin-react-hooks` recommended rules active
- React Refresh: `react-refresh/only-export-components` set to `"warn"`
- `@typescript-eslint/no-unused-vars`: explicitly set to `"off"` — unused variables are not flagged
- TypeScript strict mode: **disabled** (`strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`)

## Import Organization

**Order (observed pattern):**
1. React and third-party library imports — `import { useState } from 'react'`, `import { supabase } from '@supabase/supabase-js'`
2. Internal context and hooks — `import { useAuth } from '@/contexts/AuthContext'`
3. Internal components — `import { Button } from '@/components/ui/button'`
4. Internal types and API — `import { Conversation } from '@/lib/api'`
5. Lucide icons last among imports — `import { Loader2, MessageSquare } from 'lucide-react'`

**Path Aliases:**
- `@/` resolves to `./src/` — configured in `tsconfig.app.json` paths and `vitest.config.ts` resolve alias
- Used consistently across all source files for internal imports
- Only `src/lib/supabase.ts` is imported with `@/lib/supabase`; the canonical client is `@/integrations/supabase/client` — both exist and are used interchangeably

**Wildcard/Namespace Imports:**
- `import * as React from "react"` used in some UI primitives (e.g., `use-mobile.tsx`, `button.tsx`)
- Named imports used everywhere else

## Error Handling

**API functions (`src/lib/api.ts`):**
- Functions return empty arrays (`[]`) on Supabase query errors — they do not throw
- Errors are logged via `console.error` at the call site before returning the fallback
- `throw error` / `throw new Error(...)` used only when the caller is expected to handle failure (e.g., `closeConversation`, `createContact`, `saveBotTraining`)
- Catch blocks use `error: any` — typed error handling is not enforced

**Component-level error handling:**
- `try/catch` wraps async operations inside `useEffect` data-loading functions
- On error, `toast({ title: 'Erro', description: '...', variant: 'destructive' })` is shown to the user
- Two toast systems coexist: `sonner` (via `import { toast } from 'sonner'`) and the custom shadcn toast hook (`import { toast } from '@/hooks/use-toast'`) — usage varies by file

**Context layer:**
- `useAuth()` and `useBot()` throw `new Error('useX must be used within a XProvider')` if consumed outside their provider — standard guard pattern

## Logging

**Framework:** `console.log` / `console.error` / `console.warn` (no structured logging library)

**Patterns:**
- Debug emoji prefixes used in API functions to mark steps: `console.log("🔍 1. ...")`, `console.log("✅ 2. ...")`, `console.error("❌ ERRO...")`
- These are development-time logs and are not removed from production builds
- `console.warn` used for non-fatal warnings in API (e.g., no bot found for slug)

## Comments

**When to Comment:**
- Inline comments explain intent for non-obvious operations — e.g., `// Use setTimeout to avoid potential deadlocks`
- Section dividers with `// ---` separate logical blocks within long files
- Numbered step comments (`// 1.`, `// 2.`) used in multi-step async functions in `src/lib/api.ts`
- Portuguese comments are common — `// Certifique-se de que o caminho está correto`, `// Mocks temporários`

**JSDoc/TSDoc:**
- Not used. No `/** ... */` doc comments found in source files.

## Function Design

**Size:** Functions range from very small (2–5 lines for utility/handler) to large (50–100+ lines for complex async API functions like `fetchDashboard`, `sendMessage`)

**Parameters:**
- Props are destructured inline in component function signatures
- API functions receive primitive arguments (strings, objects) — not class instances
- Payload objects used for multi-field inputs: `sendMessage(payload: { conversationId, content, type, attachmentUrl? })`

**Return Values:**
- API async functions return typed Promises: `Promise<Conversation[]>`, `Promise<void>`, `Promise<Message>`
- Functions that cannot complete return empty array or fallback object rather than throwing (except documented throw cases)

## Module Design

**Exports:**
- Pages: single default export per file
- Components and contexts: named exports (e.g., `export function AuthProvider`, `export function useAuth`)
- UI primitives: named exports with `displayName` set for React DevTools
- `src/lib/api.ts` uses named function exports for every API call — no default export

**Barrel Files:**
- Not used. Each file is imported directly by path. No `index.ts` barrel files exist in `src/components/` or `src/pages/`.

## TypeScript Usage

**Strictness:** Low — `strict: false`, `noImplicitAny: false` in `tsconfig.app.json`
- `as any` casts used in several places in `src/lib/api.ts` (e.g., `(chat as any).contact_avatar`, `(data as any[]).map(...)`)
- Type assertions on status/sender fields: `(chat.status as Conversation['status'])`
- Mixed naming: DB columns use `snake_case` from Supabase; mapped to `camelCase` in application types

**Interface vs Type:**
- `interface` preferred for object shapes (component props, context types, API models)
- `type` used for union/string aliases (`BotType`, `FilterType`, `AppRole`)

---

*Convention analysis: 2026-04-29*

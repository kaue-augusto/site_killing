# Testing Patterns

**Analysis Date:** 2026-04-29

## Test Framework

**Runner:**
- Vitest 3.x
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`) + `@testing-library/jest-dom` matchers (imported in setup)

**DOM Environment:**
- `jsdom` (configured via `vitest.config.ts` `environment: "jsdom"`)

**Component Testing Library:**
- `@testing-library/react` 16.x (installed but not used in existing tests)

**Run Commands:**
```bash
npm run test          # Run all tests once (vitest run)
npm run test:watch    # Watch mode (vitest)
```

No coverage script is defined in `package.json`.

## Test File Organization

**Location:**
- Currently all tests live in a dedicated `src/test/` directory — NOT co-located with source files
- Pattern: `src/test/<name>.test.ts`

**Naming:**
- `<name>.test.ts` for TypeScript unit tests
- `<name>.test.tsx` for component tests (none present yet)

**Vitest include glob:**
```
src/**/*.{test,spec}.{ts,tsx}
```
Tests placed anywhere under `src/` matching this pattern will be picked up automatically.

**Current test files:**
- `src/test/example.test.ts` — placeholder only
- `src/test/setup.ts` — global setup file (not a test file)

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

**Patterns:**
- Explicit Vitest imports (`describe`, `it`, `expect`) from `"vitest"` — not from globals
  - Note: `globals: true` is set in `vitest.config.ts`, so globals are available but the existing test uses explicit imports
- Setup file (`src/test/setup.ts`) imports `@testing-library/jest-dom` to extend `expect` with DOM matchers
- Setup file polyfills `window.matchMedia` — required for components that use media queries (e.g., `useIsMobile` in `src/hooks/use-mobile.tsx`)

**Setup file (`src/test/setup.ts`):**
```typescript
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
```

## Mocking

**Framework:** Vitest built-in (`vi.mock`, `vi.fn`, `vi.spyOn`) — available via globals

**What to Mock (for this codebase):**
- Supabase client (`@/integrations/supabase/client`) — all data fetching uses it
- `@/lib/api` — API functions called by page components
- `@/contexts/AuthContext` — components consume `useAuth` everywhere
- `@/contexts/BotContext` — components consume `useBot` for bot selection
- `window.matchMedia` — already polyfilled in setup for all tests
- `sonner` toast and `@/hooks/use-toast` — components call these on errors

**Pattern for mocking Supabase (recommended):**
```typescript
import { vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));
```

**What NOT to Mock:**
- `src/lib/utils.ts` (`cn` function) — pure utility, test directly
- `date-fns` — pure functions, no need to mock
- React itself — use real React with jsdom

## Fixtures and Factories

**Test Data:**
- No dedicated fixture files or factory functions exist yet
- `src/lib/api.ts` contains module-level mock data objects (`mockContacts`, `mockAgent`) used as fallbacks — these can be imported in tests if needed

**Recommended pattern for new tests:**
```typescript
// Define inline in test file or in src/test/fixtures/<model>.ts
const mockConversation: Conversation = {
  id: "conv-1",
  contactName: "Test User",
  contactPhone: "+5511999990000",
  lastMessage: "Hello",
  lastMessageTime: new Date("2026-01-01T10:00:00Z"),
  unreadCount: 0,
  status: "open",
  botId: "sac",
};
```

**Location for fixtures:**
- Place in `src/test/fixtures/` (directory does not exist yet — create as needed)

## Coverage

**Requirements:** None enforced — no coverage threshold configured in `vitest.config.ts`

**View Coverage:**
```bash
npx vitest run --coverage
```
(Requires `@vitest/coverage-v8` or `@vitest/coverage-istanbul` to be installed — not currently in `package.json`)

## Test Types

**Unit Tests:**
- Scope: Pure functions, utility helpers, isolated hooks
- Approach: Import function, call with input, assert output
- Example target: `src/lib/utils.ts` (`cn`), `src/lib/api.ts` mapping logic

**Integration Tests:**
- Scope: React components with context providers
- Approach: Use `@testing-library/react` `render` with wrapper providers; assert DOM output
- Example target: `src/pages/Login.tsx`, `src/components/atendimentos/ConversationList.tsx`

**E2E Tests:**
- Not used. No Playwright or Cypress is installed.

## Common Patterns

**Async Testing:**
```typescript
import { describe, it, expect, vi } from "vitest";

describe("fetchConversations", () => {
  it("returns empty array when bot not found", async () => {
    // mock supabase here
    const result = await fetchConversations("nonexistent-slug");
    expect(result).toEqual([]);
  });
});
```

**Component Rendering:**
```typescript
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Wrap with required providers
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
}
```

**Error Testing:**
```typescript
it("throws when used outside provider", () => {
  expect(() => renderHook(() => useAuth())).toThrow(
    "useAuth must be used within an AuthProvider"
  );
});
```

## Current State Assessment

The test suite is effectively empty — only a placeholder test exists (`src/test/example.test.ts`). The infrastructure is correctly configured (Vitest, jsdom, `@testing-library/react`, `@testing-library/jest-dom`, `matchMedia` polyfill) but no production code is covered by tests.

**Priority areas to test first:**
1. `src/lib/utils.ts` — trivial, zero-dependency
2. `src/lib/api.ts` mapping/transform logic (not the Supabase calls)
3. `src/contexts/AuthContext.tsx` — high business impact, testable with mocked Supabase
4. `src/components/atendimentos/ConversationList.tsx` — pure rendering, no external deps beyond props

---

*Testing analysis: 2026-04-29*

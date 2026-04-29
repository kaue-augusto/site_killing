# Codebase Concerns

**Analysis Date:** 2026-04-29

---

## Tech Debt

**Hardcoded Z-API Client Token exposed in frontend source:**
- Issue: A real API credential (`Client-Token: F24b2619953344130ba2eaf6d576dddceS`) is hardcoded in client-side TypeScript that ships to the browser.
- Files: `src/lib/api.ts` (lines 274, 563, 611, 632)
- Impact: Anyone who inspects the built JavaScript bundle can extract this token and make unauthorized Z-API calls billed to this account.
- Fix approach: Move Z-API calls to a Supabase Edge Function. Pass only the intent from the client; the Edge Function holds the client token in a secret env var.

**Dual Supabase client instances:**
- Issue: Two separate `createClient` calls exist in the codebase, creating two independent auth/session contexts.
- Files: `src/integrations/supabase/client.ts`, `src/lib/supabase.ts`
- Impact: Components that import from `@/lib/supabase` (e.g., `src/pages/Treinamento.tsx`, `src/pages/Atendimentos.tsx`) share no session state with components importing from `@/integrations/supabase/client`. Realtime subscriptions in `Atendimentos.tsx` use the secondary client while auth is managed by the primary, which can cause silent auth failures or duplicate connections.
- Fix approach: Delete `src/lib/supabase.ts`. Update all imports pointing to it to use `@/integrations/supabase/client` instead.

**`autoTransfer` toggle not persisted:**
- Issue: The "Transferência Automática" switch in `Treinamento.tsx` stores its value in local component state (`autoTransfer`) but `handleSaveTraining` never passes it to `saveBotTraining`. The `BotTrainingConfig` interface includes `autoTransfer` but it is ignored on save.
- Files: `src/pages/Treinamento.tsx` (lines 46, 780), `src/lib/api.ts` (line 21)
- Impact: Users believe they are toggling auto-transfer behaviour, but the setting is lost on page reload.
- Fix approach: Include `autoTransfer` in the `saveBotTraining` call and persist it in the `bots` table column.

**`instrucoesFinais` constructed but `instructions` (without injected identity) is saved:**
- Issue: `handleSaveTraining` in `Treinamento.tsx` builds `instrucoesFinais` by appending the bot name, then passes `instructions` (the original, unaugmented value) to `saveBotTraining`. The composed string is computed but never used.
- Files: `src/pages/Treinamento.tsx` (lines 379-392)
- Impact: The identity directive appended to `instrucoesFinais` is silently discarded on every save.
- Fix approach: Either pass `instrucoesFinais` to `saveBotTraining` or remove the dead composition code.

**Mock data silently returned on fetch failures:**
- Issue: `fetchContacts` returns `mockContacts` (a hardcoded single entry with fake data) when the bot query fails, making errors invisible to users.
- Files: `src/lib/api.ts` (line 421)
- Impact: Operators see fake contact data instead of an error, making data quality issues undetectable.
- Fix approach: Throw or return an empty array with an error flag; let the UI surface the failure.

**`reportContact` is a no-op stub:**
- Issue: The function `reportContact` sleeps 200 ms then logs to the console. No record is written to the database.
- Files: `src/lib/api.ts` (lines 506-509)
- Impact: User reports are silently discarded. The toast message "a denúncia foi registrada" is misleading.
- Fix approach: Write a record to a `contact_reports` table (or equivalent) and remove the stub.

**SLA metrics are hardcoded:**
- Issue: `fetchDashboard` returns a static weekly SLA array with fabricated numbers.
- Files: `src/lib/api.ts` (lines 393-400, 410)
- Impact: The Dashboard SLA chart always shows the same hardcoded data regardless of real response times.
- Fix approach: Calculate average response times from `messages.created_at` grouped by day; persist a `responded_at` timestamp on messages to enable the calculation.

**`avgResponseTime` is a hardcoded string:**
- Issue: The KPI "Tempo médio de resposta" always returns `'1m 20s'`.
- Files: `src/lib/api.ts` (line 409)
- Impact: Metric is meaningless. Operators cannot track real performance.
- Fix approach: Derive from `messages` timestamps when `responded_at` field is available.

**`handleGenerateQR` calls Z-API twice on success:**
- Issue: `handleGenerateQR` in `Treinamento.tsx` calls `generateWhatsAppQR` once before the `setIsGeneratingQR(true)` guard, then calls it again inside the try-catch below it. Two sequential disconnect+QR requests are fired.
- Files: `src/pages/Treinamento.tsx` (lines 412-449)
- Impact: The instance is disconnected and re-requested twice, causing unnecessary Z-API rate use and a confusing double-toast on error.
- Fix approach: Remove the duplicated call block (lines 413-430); keep only the guarded block.

**`fetchBotPdfs` queries by `bot_id` using the bot slug:**
- Issue: `fetchBotPdfs` passes `botSlug` into `.eq('bot_id', botSlug)`, but `arquivos_bot.bot_id` is an integer/UUID foreign key to `bots.id`, not to `bots.slug`.
- Files: `src/lib/api.ts` (lines 678-697)
- Impact: PDF list always returns empty for all bots because slug ≠ id.
- Fix approach: Resolve the slug to an id first (same pattern as `fetchContacts`), then query by `bot_id`.

**`BotContext` non-admin bot filter uses `user_id` column, not `user_roles`:**
- Issue: When `isAdmin` is false, `fetchBots` filters bots by `bots.user_id = user.id`. Non-admin users assigned via the invite/role system but who did not create the bot will see no bots, because bot ownership is independent of the role assignment table.
- Files: `src/contexts/BotContext.tsx` (lines 38-39)
- Impact: Invited `atendente` and `supervisor` users cannot see any bots unless they happen to own them.
- Fix approach: For non-admin users, join `user_roles` on `bot_id` and filter by `user_id` in that table.

**`ConversationList` "Minhas" filter uses hardcoded `'agent-1'` ID:**
- Issue: The "Minhas" (mine) filter compares `conv.assignedTo === 'agent-1'`, which is a leftover mock ID.
- Files: `src/components/atendimentos/ConversationList.tsx` (line 90)
- Impact: The filter never matches real conversations; the "Minhas" tab is always empty.
- Fix approach: Pass the authenticated user's ID from the auth context into `ConversationList` and use it for the comparison.

**Widespread `as any` type casts masking schema mismatches:**
- Issue: Database payloads are cast to `any` throughout the API layer and realtime handlers, bypassing TypeScript type checking.
- Files: `src/lib/api.ts` (lines 161, 182, 349), `src/pages/Atendimentos.tsx` (lines 101, 159), `src/pages/Crm.tsx` (lines 119, 190, 208, 233, 258, 296)
- Impact: Schema changes in Supabase will silently produce runtime `undefined` values with no compile-time warning. The `crm_leads` table is not in `src/integrations/supabase/types.ts`, requiring `(supabase as any)` for all CRM queries.
- Fix approach: Generate types after adding `crm_leads` to the schema; remove `as any` casts and use the generated types.

**Stale `atendimento1-main/` nested directory:**
- Issue: A directory `atendimento1-main/` exists inside the project root containing only an `index.html`.
- Files: `atendimento1-main/index.html`
- Impact: Confusing artifact that may be a previous project version. Vite could accidentally pick up its `index.html` in some configurations.
- Fix approach: Delete the directory; it serves no purpose.

**Debug scripts committed to the repository:**
- Issue: `check_chats.cjs` and `check_messages.cjs` are Node.js scripts that parse `.env` and query Supabase directly. They are committed to the repo and are runnable by anyone with the repo access.
- Files: `check_chats.cjs`, `check_messages.cjs`
- Impact: These are debugging artifacts that parse environment files at runtime. They should not be in version control.
- Fix approach: Add `*.cjs` debug scripts to `.gitignore` and delete the files.

---

## Known Bugs

**PDF viewer creates unrevoked Blob URLs for large files:**
- Symptoms: `viewSecurePdf` decodes a Base64 PDF (potentially megabytes), creates a Blob URL, opens it, then schedules revocation in 60 seconds via `setTimeout`. If the user keeps the tab open, the Blob leaks for 60 s and the GC cannot collect the backing ArrayBuffer.
- Files: `src/lib/api.ts` (lines 706-718)
- Trigger: Viewing any PDF document.
- Workaround: None; revocation happens after 60 s.

**Realtime sidebar channel subscribes globally to all message inserts:**
- Symptoms: The `atualiza-sidebar` realtime channel in `Atendimentos.tsx` listens to every `INSERT` on `messages` with no server-side filter. High-volume bots will push updates for every message to every connected browser.
- Files: `src/pages/Atendimentos.tsx` (lines 152-186)
- Trigger: Any user having the Atendimentos page open while another bot receives messages.
- Workaround: None currently; mitigated only by low total message volume.

**`handleModeSelection` parameter missing TypeScript annotation:**
- Symptoms: `handleModeSelection(modeId)` in `Treinamento.tsx` has an untyped parameter, causing an ESLint implicit-any warning.
- Files: `src/pages/Treinamento.tsx` (line 644)
- Trigger: Every call to mode selection. Does not break runtime but fails strict TypeScript checks.
- Workaround: Not harmful at runtime.

---

## Security Considerations

**Z-API Client Token hardcoded in client bundle:**
- Risk: Static API token shipped in client-side code grants full Z-API access to any actor who inspects the bundle.
- Files: `src/lib/api.ts` (lines 274, 563, 611, 632)
- Current mitigation: None.
- Recommendations: Move all Z-API calls server-side via Edge Functions. Rotate the current token immediately.

**CORS wildcard `Access-Control-Allow-Origin: '*'` on Edge Functions:**
- Risk: Both `upload-gcp-pdf` and `generate-signed-url` Edge Functions return `*` for CORS, allowing any origin to call them.
- Files: `supabase/functions/upload-gcp-pdf/index.ts` (line 5), `supabase/functions/generate-signed-url/index.ts` (line 6)
- Current mitigation: Supabase JWT validation is required by default on Edge Functions if the `Authorization` header is enforced. Verify that the `apikey` header check is active.
- Recommendations: Restrict `Access-Control-Allow-Origin` to the known production domain.

**Invite flow assigns roles from client without server validation:**
- Risk: `AceitarConvite.tsx` directly inserts rows into `user_roles` from the client. If Supabase RLS policies do not restrict who can insert into `user_roles`, a user could self-assign any role.
- Files: `src/pages/AceitarConvite.tsx` (lines 151-183)
- Current mitigation: Depends entirely on RLS policies in Supabase (not visible in this codebase).
- Recommendations: Move role assignment to an Edge Function or a `SECURITY DEFINER` database function that validates the invite token server-side before inserting.

**Password minimum length is only 6 characters:**
- Risk: Supabase defaults allow weak passwords. The client enforces only 6 characters.
- Files: `src/pages/AceitarConvite.tsx` (line 102)
- Current mitigation: Supabase Auth enforces its own minimum (also 6 by default).
- Recommendations: Increase minimum to 8–12 characters and consider adding strength requirements in the UI.

**`.env` file not in `.gitignore`:**
- Risk: The `.gitignore` does not include `.env` as an exclusion pattern. A `.env` file exists at the project root. If committed, Supabase credentials are exposed in version history.
- Files: `.gitignore`, `.env` (exists, contents not read)
- Current mitigation: The file may not have been staged; check `git status`.
- Recommendations: Add `.env` and `.env.*` to `.gitignore` immediately; audit git history to confirm no secrets were committed.

---

## Performance Bottlenecks

**`fetchConversations` fetches all messages to find the latest per chat:**
- Problem: To populate `lastMessage` in the conversation list, the function fetches all messages for all chats in a single query with no `LIMIT` per chat. For a bot with 500 chats averaging 200 messages each, this could return 100,000+ rows.
- Files: `src/lib/api.ts` (lines 133-147)
- Cause: No per-chat `LIMIT 1` is applied; all messages are loaded and de-duped client-side.
- Improvement path: Use a `DISTINCT ON (chat_id) ORDER BY created_at DESC` PostgreSQL query, or add a `last_message_content` denormalized column to `chats` updated by a database trigger.

**`fetchDashboard` executes 4 separate sequential Supabase queries:**
- Problem: Bots, filtered chats, global chats for the chart, and human messages are fetched in separate round trips with no parallel execution for some paths.
- Files: `src/lib/api.ts` (lines 323-410)
- Cause: `globalChats` and `humanMsgs` queries are fired after awaiting `chats`, making them effectively sequential.
- Improvement path: Use `Promise.all` for independent queries; consider a single RPC/view that returns the aggregate data.

**Treinamento page starts a 5-second polling interval on every bot switch:**
- Problem: `setInterval(checkConnection, 5000)` is created inside a `useEffect` that depends on `selectedBot`. Each bot selection creates a new interval (the old one is cleared by cleanup, but during the brief overlap both fire).
- Files: `src/pages/Treinamento.tsx` (lines 341-369)
- Cause: WhatsApp status polling is unconditional — it runs even when Z-API credentials are absent, making needless API calls.
- Improvement path: Only start the interval when `selectedBot.zapInstance` and `selectedBot.zapToken` are both present.

**Realtime channels are recreated on every `selectedConversation` change:**
- Problem: `messagesChannel` subscribes and unsubscribes on every conversation switch. Under fast switching (e.g., mobile users tapping through conversations), channels may stack up before cleanup completes.
- Files: `src/pages/Atendimentos.tsx` (lines 86-146)
- Cause: `selectedConversation` object reference changes on every fetch refresh (`setConversations`), triggering re-subscription even if the same chat is selected.
- Improvement path: Use `selectedConversation.id` as the dependency instead of the full object.

---

## Fragile Areas

**`Treinamento.tsx` (1327 lines) — God component:**
- Files: `src/pages/Treinamento.tsx`
- Why fragile: A single component manages WhatsApp QR/status polling, PDF upload, Q&A CRUD, website scraping, matriculas CRUD, and bot training config — all in one deeply nested state machine. Any change risks unintended side effects across tabs.
- Safe modification: Change one tab's feature at a time. Read the full `useEffect` at line 290 before touching any state that it depends on, as it loads data for every tab and starts the polling interval.
- Test coverage: No tests exist for this component.

**`src/lib/api.ts` — Mixed concerns with no separation:**
- Files: `src/lib/api.ts`
- Why fragile: The file mixes type definitions, mock data, Supabase queries, Z-API HTTP calls, GCP upload logic, and PDF Blob generation. There is no service layer separation.
- Safe modification: Any edit risks breaking an unrelated feature. Before modifying a function, search for all callers across `src/pages/` and `src/components/`.
- Test coverage: No tests.

**`AuthContext.tsx` — Double initialization on mount:**
- Files: `src/contexts/AuthContext.tsx` (lines 91-131)
- Why fragile: On mount, the component sets up an `onAuthStateChange` listener AND immediately calls `getSession()`. Both paths call `fetchProfile` and `fetchRoles` and set `isLoading = false`. Under a race condition (e.g., fast network), profile/roles may be fetched twice and `isLoading` may be set false before the auth state listener finishes.
- Safe modification: Add a guard flag to prevent the `getSession` branch from running if `onAuthStateChange` already handled the session.
- Test coverage: No tests.

---

## Scaling Limits

**Realtime sidebar channel (no bot filter):**
- Current capacity: Functional at low volume (< ~50 concurrent connections, < ~10 messages/second).
- Limit: Supabase Realtime has per-project connection and event-rate limits. A global unfiltered `messages` subscription means every insert across all bots propagates to every connected browser.
- Scaling path: Add a `bot_id` filter to the sidebar Realtime subscription so each client only receives events relevant to the selected bot.

**`fetchConversations` all-messages query:**
- Current capacity: Works with a few hundred chats with low message counts.
- Limit: Will time out or hit Supabase row limits with large bots (>1000 chats, >100 messages each).
- Scaling path: Denormalize `last_message_content` and `last_message_at` on the `chats` table; update via database trigger.

---

## Dependencies at Risk

**`deno.land/std@0.168.0` pinned in Edge Functions:**
- Risk: Deno standard library version 0.168.0 is from 2022. Supabase Edge Functions runtime is regularly updated and may deprecate this version.
- Files: `supabase/functions/generate-signed-url/index.ts` (line 1), `supabase/functions/upload-gcp-pdf/index.ts` (line 1)
- Impact: Functions could break on a Supabase runtime update without any source-code change.
- Migration plan: Update to `deno.land/std@latest` or use the specific version recommended in current Supabase Edge Function docs.

**`react-day-picker` v8 with `date-fns` v3:**
- Risk: `react-day-picker@8.x` officially supports `date-fns@2.x`. Using `date-fns@3.x` in the same project causes known type incompatibilities in `DayPicker` component types.
- Files: `package.json` (lines 57, 49)
- Impact: Calendar component (`src/components/ui/calendar.tsx`) may produce TypeScript errors or subtle date formatting bugs.
- Migration plan: Upgrade `react-day-picker` to v9 (which supports `date-fns` v3) or pin `date-fns` to v2.

---

## Missing Critical Features

**No database-level RLS verification visible:**
- Problem: Row Level Security policies are not present in the committed migration files. All data access relies on client-side role checks (`isAdmin`, `canAccessBot`) that can be bypassed.
- Blocks: Production readiness — any authenticated user could query any bot's chats or messages directly through the Supabase API if RLS is not configured.

**No error boundary in the React tree:**
- Problem: There are no React `ErrorBoundary` components wrapping page-level components. An unhandled JS error in any page component will unmount the entire application with a blank screen.
- Blocks: Production stability and user experience.

**`blockContact` marks all chats with that phone number as blocked — no confirmation:**
- Problem: `blockContact` updates every chat row matching the contact's phone number to `status: 'blocked'`. This is a destructive, non-reversible operation with no confirmation dialog and no un-block capability in the UI.
- Blocks: Safe operator use; accidental blocks cannot be reversed without direct database access.

---

## Test Coverage Gaps

**All business logic is untested:**
- What's not tested: `fetchConversations`, `fetchMessages`, `sendMessage`, `closeConversation`, `fetchDashboard`, `fetchContacts`, and all other functions in `src/lib/api.ts`.
- Files: `src/lib/api.ts`
- Risk: Any regression in data mapping, status logic, or attachment URL resolution goes undetected until production.
- Priority: High

**All page components are untested:**
- What's not tested: `Atendimentos.tsx`, `Treinamento.tsx`, `Configuracoes.tsx`, `Dashboard.tsx`, `Crm.tsx`.
- Files: `src/pages/`
- Risk: UI state transitions, realtime handlers, and form submission flows are entirely unverified.
- Priority: High

**Auth context behavior is untested:**
- What's not tested: Login, logout, role resolution, `canAccessBot`, double-initialization race condition.
- Files: `src/contexts/AuthContext.tsx`
- Risk: Authentication bugs are the highest-impact category and the hardest to catch manually.
- Priority: High

**Only test is a trivial placeholder:**
- What's not tested: Everything. The sole test file asserts `true === true`.
- Files: `src/test/example.test.ts`
- Risk: CI passes green for any codebase state, giving a false sense of safety.
- Priority: High — replace with real tests before adding more features.

---

*Concerns audit: 2026-04-29*

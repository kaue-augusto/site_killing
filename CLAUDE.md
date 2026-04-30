# Kisabot — Project Guide

## Project

Kisabot é uma plataforma de atendimento WhatsApp com IA (n8n + Vertex AI/Gemini + Supabase + GCP + Z-API + Firecrawl). Painel React para atendentes e gestores.

See: .planning/PROJECT.md

## GSD Workflow

This project uses GSD (Get Shit Done) for structured execution.

**Current milestone:** v1 Hardening & AI Capabilities
**Roadmap:** .planning/ROADMAP.md
**Requirements:** .planning/REQUIREMENTS.md
**Config:** .planning/config.json (interactive mode, coarse granularity)

### Phase Execution Order

1. `/gsd-discuss-phase 1` → `/gsd-plan-phase 1` → `/gsd-execute-phase 1`
2. Phases 2 and 3 can run in parallel after Phase 1 completes
3. Phase 4 is gated on Phase 3 (requires n8n queue mode for TTS/image load)

### Commands

- `/gsd-plan-phase [N]` — Plan a phase
- `/gsd-execute-phase [N]` — Execute a planned phase
- `/gsd-progress` — Check project status
- `/gsd-discuss-phase [N]` — Gather context before planning

## Key Files

- `src/lib/api.ts` — All DB queries and external HTTP calls
- `src/integrations/supabase/client.ts` — Canonical Supabase client (use this, not src/lib/supabase.ts)
- `src/pages/Atendimentos.tsx` — Main chat panel with Realtime subscriptions
- `supabase/functions/` — Edge Functions (Deno)
- `WhatsApp - GCP_completo.json` — n8n flow definition

## Critical Constraints

- **DO NOT** use `src/lib/supabase.ts` — it creates a duplicate client (Phase 1 will delete it)
- **DO NOT** add the Z-API Client-Token to client-side code — must stay server-side
- **DO NOT** use OAuth2 for GCP in n8n — must use Service Account JSON
- All Z-API calls must go through the `send-whatsapp` Supabase Edge Function after Phase 1

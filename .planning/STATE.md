# Kisabot — Project State

*This file is the persistent memory of the project. It is updated at every phase transition and plan completion.*

---

## Project Reference

**Core Value**: Atender o máximo de clientes simultaneamente via WhatsApp com IA estável — sem paradas, sem intervenção manual, com histórico completo disponível no painel.

**Current Focus**: Phase 1 — Foundation Hardening (security fixes and credential stabilization before any other work)

---

## Current Position

| Field | Value |
|-------|-------|
| Milestone | v1 Hardening & AI Capabilities |
| Current Phase | 1 — Foundation Hardening |
| Current Plan | None (planning not yet started) |
| Phase Status | Not started |
| Overall Progress | 0/4 phases complete |

```
Progress: [          ] 0%
Phase 1 ░░░░░░░░░░  Phase 2 ░░░░░░░░░░  Phase 3 ░░░░░░░░░░  Phase 4 ░░░░░░░░░░
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases defined | 4 |
| Requirements mapped | 28/28 |
| Plans complete | 0 |
| Plans total | TBD |
| Phases complete | 0/4 |

---

## Accumulated Context

### Key Decisions Made

| Decision | Rationale | Phase |
|----------|-----------|-------|
| 4-phase coarse structure | Research shows hard sequential dependencies; coarse granularity avoids artificial splits | Roadmap |
| Phase 1 = security-first | Z-API token exposure and dual Supabase client are active production risks that make every subsequent change unpredictable | Roadmap |
| Phase 3 can overlap Phase 2 | n8n infrastructure is fully independent of React SPA; parallelizable per config | Roadmap |
| Phase 4 gated on Phase 3 | TTS + image processing add concurrent n8n workload; queue mode must absorb it first | Roadmap |

### Known Risks

| Risk | Mitigation | Status |
|------|-----------|--------|
| Z-API token in browser bundle | Phase 1: move to Supabase Edge Function proxy | Pending |
| GCP OAuth2 7-day expiry causing silent outages | Phase 1: migrate to Service Account JSON | Pending |
| Dual Supabase client auth/Realtime split-brain | Phase 1: delete `src/lib/supabase.ts` | Pending |
| n8n single-process saturation at 50+ concurrent conversations | Phase 3: queue mode + Redis + workers | Pending |
| TTS audio format rejection by WhatsApp | Phase 4: OGG_OPUS encoding + PTT sandbox test (TTS-05) | Pending |
| `fetchConversations` all-messages query timeout at scale | Phase 2: fix with DISTINCT ON RPC before React Query migration | Pending |

### Open TODOs

- Plan Phase 1 before starting any code changes
- Rotate Z-API Client-Token immediately after Edge Function proxy is deployed (token is currently exposed)
- Validate n8n installed version before writing Phase 3 Docker Compose topology (env var names may differ)
- Benchmark WhatsApp image sizes vs Vertex API latency before Phase 4 TTS/image implementation

### Blockers

None at this time.

---

## Session Continuity

**Last session:** 2026-04-29 — Roadmap created (4 phases, 28/28 requirements mapped)
**Next action:** Run `/gsd-plan-phase 1` to decompose Phase 1 into executable plans

---

*State initialized: 2026-04-29*
*Last updated: 2026-04-29 after roadmap creation*

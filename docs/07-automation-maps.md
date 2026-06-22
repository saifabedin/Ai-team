# 07 — Automation Maps

How autonomous work is triggered. Three engines: **BullMQ** (in-process task
queue), **cron/scheduler**, and **n8n** (visual webhooks, already in the stack).

## Triggers → Actions

| Trigger | Engine | Action | Agent |
|---|---|---|---|
| New lead inserted | BullMQ `enrich` | enrich lead | scout |
| Enriched | BullMQ `score` | score lead | scout |
| Score grade A/B | rule (service) | auto-enroll in default sequence | nova |
| Enrollment `next_run_at` due | cron → `outreach` | send next step | nova |
| Inbound email/WhatsApp reply | webhook (n8n) → `/sdr/leads/:id/reply` | handle objection / book | nova |
| Scored lead w/ phone, grade A | cron → `voice` | outbound call | vox |
| `meeting.booked` (bus) | subscriber | (future) calendar invite + reminder | vox |
| Meeting marked done + agreed | manual/n8n | generate proposal | quill |
| Proposal `accepted` | webhook | onboard client | sage |
| Daily 09:00 | cron | post CEO daily report to Telegram | dashboard |
| Weekly | cron | client status emails | sage |
| Content calendar date | cron/n8n | generate + queue for approval | muse |

## BullMQ queues (`core/queue.cjs`)
`scrape · enrich · score · outreach · voice · proposal · content · success`
— retries 3×, exponential backoff, processed by `workers/index.cjs`.

## Scheduling
- **Cron**: a small scheduler (or PM2 cron / system cron / n8n schedule node)
  enqueues due work: `enrollments` runner, voice campaigns, daily report.
- **n8n** (`:5678`, docker): best for inbound webhooks (email/WhatsApp providers
  posting replies) and for fan-out to external free APIs (Sheets, Notion, social).
  Each n8n node calls a gateway endpoint — no logic duplicated.

## Daily autonomous cycle (example)
```
08:30  scout: source N leads per target vertical → enrich → score
09:00  dashboard: daily report → Telegram (yesterday's revenue/meetings/leads)
09:30  nova: run all due sequence steps
11:00  vox: call today's grade-A leads with phone
14:00  muse: generate next day's content drafts → owner approval
17:00  sage: client health check + upsell scan
hourly nova: process inbound replies (via n8n webhook, event-driven)
```

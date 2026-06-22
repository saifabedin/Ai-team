# 06 — Workflows

## A. Lead → Revenue (the core loop)
```
[scout] source (gmaps/web/linkedin)
   → upsert company + insert lead (status=new)
   → queue:enrich → fill email/phone (status=enriched)
   → queue:score  → LLM score+grade (status=scored)
   → grade A/B?  ── yes ─→ [nova] enroll in sequence
                              → run step 1 (email)  (status=contacted)
                              → lead replies → [nova] handleReply
                                   ├ interested/positive → book meeting (status=meeting)
                                   ├ objection → tailored reply, continue cadence
                                   └ unsubscribe → pause + status=lost
   → (parallel/alt) [vox] call lead → outcome
                              └ booked → meeting (status=meeting)
   → meeting done & deal agreed → [quill] proposal/quote/contract (+PDF)
   → accepted → [sage] onboard → client + delivery tasks (lead status=won)
   → ongoing → [sage] status updates + upsell detection
```

## B. SDR sequence runner
```
ait_enrollments(next_run_at <= now, status=active)
   → worker pops → [nova] runStep → draft + send via channel
   → advance current_step, set next_run_at = now + step.delay_hours
   → last step → status=done
```
(Scheduler: a cron/n8n trigger enqueues due enrollments to the `outreach` queue.)

## C. Voice campaign
```
select scored leads with phone, grade A/B
   → enqueue voice jobs
   → [vox] script → dial (adapter) → transcript → outcome → CRM + meeting
```

## D. Content factory
```
topic/calendar → [muse] generate (social/blog/ad/video_script/brief)
   → store draft → human/owner approve (Telegram or dashboard)
   → publish (ECM publishing pipeline / n8n → social APIs)
```

## E. Client success
```
lead=won → [sage] onboard → 14-day plan → tasks
   weekly → status update email
   health/usage signal → upsell suggestion → [quill] upsell proposal
```

## Human-in-the-loop gates
- Outbound **send** in live mode, **proposal send**, and **content publish** are
  the recommended approval points (via Telegram `/approve` or dashboard).
- Everything before (sourcing, scoring, drafting) runs fully autonomous.

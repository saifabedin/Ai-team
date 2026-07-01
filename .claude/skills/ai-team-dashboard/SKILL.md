# ai-team-dashboard

Use for CEO dashboard work — real-time KPI display, team performance, lead pipeline, activity feed.

## Structure (`dashboard/`)
| File | Purpose |
|------|---------|
| `server.cjs` | Express server (:4101) |
| `routes.cjs` | API routes: overview, today, team, agents, feed, leads, audit |
| `metrics.cjs` | KPI aggregators: revenue, pipeline, funnel, team perf |
| `public/index.html` | CEO dashboard SPA (auto-refresh 8s, dark theme) |

## KPIs Tracked
- Revenue (MRR)
- Pipeline Value
- Deals Won
- Meetings Booked
- Qualified Leads
- Total Leads
- Funnel visualization
- Team performance per agent (runs, ok, errors, avg ms)

## Commands
```bash
node dashboard/server.cjs            # start dashboard
curl http://localhost:4101/api/overview  # KPI data
```

## Gotchas
- Dashboard auto-refreshes every 8 seconds
- Team performance data comes from `ait_agent_runs` table
- Agent status determined by last activity timestamp
- Dashboard is standalone Express server, NOT part of gateway

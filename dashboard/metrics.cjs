"use strict";
// CEO dashboard metrics — revenue, leads, meetings, pipeline, closes, team perf.
const db = require("../core/db.cjs");
const { ROSTER } = require("../core/agents.cjs");

async function overview(brandId) {
  // Wrap in a read-only transaction so all 7 counts are a consistent snapshot
  return db.tx(async (client) => {
    const q = (sql, p = [brandId]) => client.query(sql, p).then((r) => r.rows[0]);

    const [leads, scored, qualified, meetings, won, pipeline, revenue] = await Promise.all([
      q(`select count(*)::int n from ait_leads where brand_id=$1`),
      q(`select count(*)::int n from ait_leads where brand_id=$1 and status in ('scored','contacted','engaged','qualified','meeting','won')`),
      q(`select count(distinct lead_id)::int n from ait_lead_scores where brand_id=$1 and grade in ('A','B')`),
      q(`select count(*)::int n from ait_meetings where brand_id=$1 and status in ('booked','confirmed','done')`),
      q(`select count(*)::int n from ait_leads where brand_id=$1 and status='won'`),
      q(`select coalesce(sum(amount),0)::float v from ait_proposals where brand_id=$1 and status in ('draft','sent')`),
      q(`select coalesce(sum(mrr),0)::float v from ait_clients where brand_id=$1 and status='active'`),
    ]);

    const funnel = await client.query(
      `select status, count(*)::int n from ait_leads where brand_id=$1 group by status order by 1`,
      [brandId]
    ).then((r) => r.rows);

    return {
      revenue_mrr: revenue.v,
      pipeline_value: pipeline.v,
      leads_total: leads.n,
      leads_scored: scored.n,
      qualified_leads: qualified.n,
      meetings_booked: meetings.n,
      deals_won: won.n,
      funnel,
    };
  });
}

async function today(brandId) {
  const r = await db.one(
    `select
       (select count(*) from ait_leads where brand_id=$1 and created_at::date = now()::date)::int leads,
       (select count(*) from ait_meetings where brand_id=$1 and created_at::date = now()::date)::int meetings,
       (select count(*) from ait_messages where brand_id=$1 and created_at::date = now()::date)::int messages,
       (select count(*) from ait_calls where brand_id=$1 and created_at::date = now()::date)::int calls`,
    [brandId]
  );
  return r;
}

async function teamPerformance(brandId) {
  return db.many(
    `select agent, department,
            count(*)::int runs,
            count(*) filter (where status='done')::int ok,
            count(*) filter (where status='error')::int err,
            coalesce(round(avg(ms))::int,0) avg_ms
     from ait_agent_runs where brand_id=$1
     group by agent, department order by runs desc`,
    [brandId]
  );
}

// Full agent roster + live stats. Always returns every agent (even idle ones),
// merged with run counts + last-seen activity, so the dashboard shows the whole team.
async function agents(brandId) {
  const stats = await db.many(
    `select agent, department,
            count(*)::int runs,
            count(*) filter (where status='done')::int ok,
            count(*) filter (where status='error')::int err,
            count(*) filter (where status='running')::int busy,
            coalesce(round(avg(ms))::int,0) avg_ms,
            max(started_at) last_at,
            (array_agg(label order by started_at desc))[1] last_label,
            (array_agg(status order by started_at desc))[1] last_status
     from ait_agent_runs where brand_id=$1
     group by agent, department`,
    [brandId]
  );
  const byAgent = Object.fromEntries(stats.map((s) => [s.agent, s]));
  return ROSTER.map((r) => {
    const s = byAgent[r.agent] || {};
    const busy = (s.busy || 0) > 0;
    return {
      ...r,
      runs: s.runs || 0, ok: s.ok || 0, err: s.err || 0,
      avg_ms: s.avg_ms || 0,
      last_at: s.last_at || null, last_label: s.last_label || null, last_status: s.last_status || null,
      state: busy ? "working" : s.runs ? "idle" : "ready",
    };
  });
}

// Live activity feed: most recent agent runs across all departments.
async function feed(brandId, limit = 25) {
  return db.many(
    `select agent, department, label, status, ms, started_at
     from ait_agent_runs where brand_id=$1
     order by started_at desc limit $2`,
    [brandId, limit]
  );
}

// Recent leads with their latest score/grade (for the dashboard table).
async function recentLeads(brandId, limit = 12) {
  return db.many(
    `select l.id, l.full_name, l.email, l.status, l.source, c.name company,
            s.score, s.grade
     from ait_leads l
     left join ait_companies c on c.id=l.company_id
     left join lateral (select score, grade from ait_lead_scores
        where lead_id=l.id order by id desc limit 1) s on true
     where l.brand_id=$1 order by l.updated_at desc limit $2`,
    [brandId, limit]
  );
}

module.exports = { overview, today, teamPerformance, agents, feed, recentLeads };

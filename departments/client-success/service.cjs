"use strict";
// Client Success: onboard won leads, track projects, status updates, upsell.
const db = require("../../core/db.cjs");
const bus = require("../../core/bus.cjs");
const { SuccessAgent } = require("./agent.cjs");

const agent = new SuccessAgent();

// Convert a won lead into a client + onboarding tasks.
async function onboard(brandId, { leadId, name, mrr = 0 }) {
  return agent.run(brandId, "onboard", async () => {
    // Fetch data first (outside transaction)
    const lead = leadId ? await db.one(`select * from ait_leads where brand_id=$1 and id=$2`, [brandId, leadId]) : null;
    const company = lead?.company_id ? await db.one(`select * from ait_companies where id=$1`, [lead.company_id]) : null;
    const clientName = name || company?.name || "New Client";

    // LLM call outside transaction (slow — don't hold a DB connection)
    const plan = await agent.onboardingPlan({ name: clientName, mrr, health: "green" });

    // All DB writes in one transaction
    const { client, project, taskCount } = await db.tx(async (txClient) => {
      const client = await txClient.query(
        `insert into ait_clients (brand_id, company_id, lead_id, name, status, mrr, health)
         values ($1,$2,$3,$4,'onboarding',$5,'green') returning *`,
        [brandId, company?.id || null, leadId || null, clientName, mrr]
      ).then(r => r.rows[0]);

      if (lead) await txClient.query(
        `update ait_leads set status='won' where brand_id=$1 and id=$2`, [brandId, leadId]
      );

      const project = await txClient.query(
        `insert into ait_projects (brand_id, client_id, name, status, progress) values ($1,$2,$3,'active',0) returning *`,
        [brandId, client.id, "Onboarding"]
      ).then(r => r.rows[0]);

      for (const t of plan.tasks || []) {
        const due = new Date(Date.now() + (t.day || 1) * 24 * 3600 * 1000).toISOString();
        await txClient.query(
          `insert into ait_tasks (brand_id, project_id, title, status, assignee, due_at) values ($1,$2,$3,'todo','sage',$4)`,
          [brandId, project.id, t.title, due]
        );
      }
      return { client, project, taskCount: (plan.tasks || []).length };
    });

    await bus.publish({ brandId, from: "sage", to: "broadcast", topic: "client.onboarded", payload: { clientId: client.id } });
    return { clientId: client.id, projectId: project.id, tasks: taskCount, kickoffEmail: plan.kickoff_email };
  });
}

async function status(brandId, clientId) {
  return agent.run(brandId, "status-update", async () => {
    const client = await db.one(`select * from ait_clients where brand_id=$1 and id=$2`, [brandId, clientId]);
    if (!client) throw new Error("client not found");
    const projects = await db.many(`select * from ait_projects where brand_id=$1 and client_id=$2`, [brandId, clientId]);
    const email = await agent.statusUpdate(client, projects);
    return { clientId, email, projects: projects.length };
  });
}

async function upsell(brandId, clientId) {
  return agent.run(brandId, "upsell", async () => {
    const client = await db.one(`select * from ait_clients where brand_id=$1 and id=$2`, [brandId, clientId]);
    if (!client) throw new Error("client not found");
    const projects = await db.many(`select * from ait_projects where brand_id=$1 and client_id=$2`, [brandId, clientId]);
    const out = await agent.upsell(client, projects);
    return { clientId, ...out };
  });
}

function listClients(brandId, { limit = 50, offset = 0 } = {}) {
  return db.many(
    `select * from ait_clients where brand_id=$1 order by id desc limit $2 offset $3`,
    [brandId, Math.min(limit, 500), offset]
  );
}

module.exports = { onboard, status, upsell, listClients };

"use strict";
// BaseAgent — every department agent extends this.
// Gives each agent: identity, LLM access, shared memory, the bus, audit,
// and a tracked run lifecycle (agent_runs table) for the CEO dashboard.
const llm = require("./llm.cjs");
const memory = require("./memory.cjs");
const bus = require("./bus.cjs");
const audit = require("./audit.cjs");
const db = require("./db.cjs");
const { make } = require("./logger.cjs");

class BaseAgent {
  constructor(name, department, opts = {}) {
    this.name = name;
    this.department = department;
    this.log = make(`agent:${name}`);
    this.systemPrompt =
      opts.systemPrompt ||
      `You are ${name}, an AI agent in the ${department} department of FixMyLeads. FixMyLeads sells ECM AI OS — an AI-powered content + sales operating system that creates marketing content/video AND runs sales (lead-gen, outreach, booking) for businesses. Be concise, accurate, revenue-focused.`;
  }

  // --- reasoning ---
  async think(user, opts = {}) {
    return llm.complete(this.systemPrompt, user, opts);
  }
  async thinkJSON(user, opts = {}) {
    return llm.json(this.systemPrompt, user, opts);
  }

  // --- shared memory ---
  // Namespace scoped to agent name (not department) to prevent cross-agent collision
  mem(brandId) {
    const ns = this.name;
    return {
      remember: (k, v, meta) => memory.remember(brandId, ns, k, v, meta),
      recall: (k) => memory.recall(brandId, ns, k),
      setShort: (k, v, ttl) => memory.setShort(brandId, ns, k, v, ttl),
      getShort: (k) => memory.getShort(brandId, ns, k),
    };
  }

  // --- agent-to-agent ---
  send(brandId, to, topic, payload) {
    return bus.publish({ brandId, from: this.name, to, topic, payload });
  }

  // --- run lifecycle (for dashboard team performance) ---
  async run(brandId, label, fn) {
    const row = await db.one(
      `insert into ait_agent_runs (brand_id, agent, department, label, status)
       values ($1,$2,$3,$4,'running') returning id`,
      [brandId, this.name, this.department, label]
    );
    const id = row?.id;
    const start = Date.now();
    try {
      const result = await fn();
      await db.query(
        `update ait_agent_runs set status='done', ms=$2, result=$3, finished_at=now() where id=$1`,
        [id, Date.now() - start, safeJson(result)]
      );
      await audit.record({
        brandId,
        actor: this.name,
        action: `${this.department}:${label}`,
        entity: "agent_run",
        entityId: String(id),
      });
      return result;
    } catch (e) {
      await db.query(
        `update ait_agent_runs set status='error', ms=$2, error=$3, finished_at=now() where id=$1`,
        [id, Date.now() - start, e.message]
      );
      this.log.error(`run failed: ${label}`, e.message);
      throw e;
    }
  }
}

function safeJson(v) {
  try {
    return v && typeof v === "object" ? v : { value: v };
  } catch {
    return {};
  }
}

module.exports = { BaseAgent };

"use strict";
// Telegram control panel — drive the whole AI company from chat.
// Long-polling via Bot API (no extra deps). RBAC: only TELEGRAM_ALLOWED_USER_IDS.
// Commands:
//   /status              company KPIs
//   /leads               recent leads
//   /run <src> <query>   source+process leads (e.g. /run gmaps fitness mumbai)
//   /content <kind> <topic>   generate content
//   /proposal <leadId>   draft a proposal
//   /help
const axios = require("axios");
const config = require("../core/config.cjs");
const log = require("../core/logger.cjs").make("telegram");
const metrics = require("../dashboard/metrics.cjs");
const crm = require("../core/crm.cjs");
const leadIntel = require("../departments/lead-intel/service.cjs");
const content = require("../departments/content/service.cjs");
const proposal = require("../departments/proposal/service.cjs");

const TOKEN = config.telegram.token;
const BRAND = config.defaultBrandId;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;
const allowed = (id) => {
  // If no allowlist configured, deny by default (don't allow everyone)
  if (config.telegram.allowedUserIds.length === 0) return false;
  return config.telegram.allowedUserIds.includes(String(id));
};

async function send(chatId, text) {
  await axios.post(`${API}/sendMessage`, { chat_id: chatId, text, parse_mode: "Markdown" }).catch((e) =>
    log.warn("send failed", e.message)
  );
}

const money = (n) => "₹" + (n || 0).toLocaleString("en-IN");

async function handle(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || "").trim();
  if (!allowed(userId)) return send(chatId, "⛔ Not authorized.");
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ");

  try {
    switch (cmd) {
      case "/start":
      case "/help":
        return send(chatId,
          "*FixMyLeads AI Team*\n/status — KPIs\n/leads — recent leads\n/run <src> <query>\n/content <kind> <topic>\n/proposal <leadId>");
      case "/status": {
        const o = await metrics.overview(BRAND);
        return send(chatId,
          `*KPIs*\nRevenue: ${money(o.revenue_mrr)}\nPipeline: ${money(o.pipeline_value)}\nLeads: ${o.leads_total} (qualified ${o.qualified_leads})\nMeetings: ${o.meetings_booked}\nWon: ${o.deals_won}`);
      }
      case "/leads": {
        const result = await crm.listLeads(BRAND, { limit: 10 });
        return send(chatId, "*Recent leads*\n" + result.leads.map((l) => `#${l.id} ${l.full_name || "?"} — ${l.status}`).join("\n"));
      }
      case "/run": {
        const [src, ...q] = rest;
        await send(chatId, `🔎 Sourcing from ${src || "gmaps"} …`);
        const out = await leadIntel.sourceAndProcess(BRAND, { source: src || "gmaps", query: q.join(" "), limit: 3 });
        return send(chatId, "✅ Done:\n" + out.map((r) => `#${r.leadId} score ${r.score} (${r.grade})`).join("\n"));
      }
      case "/content": {
        const [kind, ...topic] = rest;
        await send(chatId, `✍️ Generating ${kind} …`);
        const out = await content.create(BRAND, { kind: kind || "social", topic: topic.join(" ") || "AI marketing" });
        return send(chatId, "✅ Content #" + out.id + " created.");
      }
      case "/proposal": {
        await send(chatId, "📝 Drafting proposal …");
        const out = await proposal.create(BRAND, { leadId: +arg || null, kind: "proposal" });
        return send(chatId, `✅ Proposal #${out.id} — ${out.amount ? money(out.amount) : "amount n/a"}`);
      }
      default:
        return send(chatId, "Unknown command. /help");
    }
  } catch (e) {
    log.error("cmd failed", e.message);
    return send(chatId, "⚠️ " + e.message);
  }
}

async function poll() {
  let offset = 0;
  log.info("telegram control panel polling…");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const { data } = await axios.get(`${API}/getUpdates`, { params: { offset, timeout: 30 }, timeout: 35000 });
      for (const u of data.result || []) {
        offset = u.update_id + 1;
        if (u.message) await handle(u.message);
      }
    } catch (e) {
      log.warn("poll error", e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

if (require.main === module) {
  if (!TOKEN) {
    log.warn("TELEGRAM_BOT_TOKEN not set — control panel idle. Set it in .env to enable.");
    setInterval(() => {}, 1 << 30);
  } else {
    poll();
  }
}

module.exports = { handle };

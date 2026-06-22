"use strict";
const db = require("../../core/db.cjs");
const { ContentAgent } = require("./agent.cjs");

const agent = new ContentAgent();

async function create(brandId, { kind = "social", topic, ...opts }) {
  if (!topic) throw new Error("topic required");
  return agent.run(brandId, `content-${kind}`, async () => {
    const data = await agent.create(kind, topic, opts);
    const title = data.title || `${kind} — ${topic}`;
    // body = human-readable text; meta = full structured JSON for querying
    const bodyText = data.body || data.content || data.caption ||
      (Array.isArray(data.posts) ? data.posts.map((p) => p.content || p).join("\n\n") : null) ||
      JSON.stringify(data);
    const row = await db.one(
      `insert into ait_content (brand_id, kind, topic, title, body, status, meta)
       values ($1,$2,$3,$4,$5,'draft',$6) returning id`,
      [brandId, kind, topic, title, bodyText, data]
    );
    return { id: row.id, kind, topic, content: data };
  });
}

function list(brandId, { limit = 50, offset = 0 } = {}) {
  return db.many(
    `select id,kind,topic,title,status,created_at from ait_content
     where brand_id=$1 order by id desc limit $2 offset $3`,
    [brandId, Math.min(limit, 200), offset]
  );
}

async function approve(brandId, id) {
  await db.query(`update ait_content set status='approved' where brand_id=$1 and id=$2`, [brandId, id]);
  return { id, status: "approved" };
}

module.exports = { create, list, approve };

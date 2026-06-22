"use strict";
// Shared memory layer: short-term (Redis, TTL) + long-term (Postgres agent_memory).
// Scoped by brand_id so the whole company shares context, multi-tenant safe.
const { redis } = require("./redis.cjs");
const db = require("./db.cjs");

const key = (brandId, ns, k) => `aiteam:mem:${brandId}:${ns}:${k}`;

const memory = {
  // --- short term (fast, ephemeral) ---
  async setShort(brandId, ns, k, value, ttlSec = 3600) {
    await redis.set(key(brandId, ns, k), JSON.stringify(value), "EX", ttlSec);
  },
  async getShort(brandId, ns, k) {
    const v = await redis.get(key(brandId, ns, k));
    return v ? JSON.parse(v) : null;
  },

  // --- long term (durable, queryable) ---
  async remember(brandId, ns, k, value, meta = {}) {
    await db.query(
      `insert into ait_agent_memory (brand_id, namespace, mem_key, value, meta)
       values ($1,$2,$3,$4,$5)
       on conflict (brand_id, namespace, mem_key)
       do update set value = excluded.value, meta = excluded.meta, updated_at = now()`,
      [brandId, ns, k, value, meta]
    );
  },
  async recall(brandId, ns, k) {
    const row = await db.one(
      `select value, meta from ait_agent_memory where brand_id=$1 and namespace=$2 and mem_key=$3`,
      [brandId, ns, k]
    );
    return row ? row.value : null;
  },
  async recallNamespace(brandId, ns, limit = 50) {
    return db.many(
      `select mem_key, value, meta, updated_at from ait_agent_memory
       where brand_id=$1 and namespace=$2 order by updated_at desc limit $3`,
      [brandId, ns, limit]
    );
  },
};

module.exports = memory;

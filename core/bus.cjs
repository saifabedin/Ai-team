"use strict";
// Agent-to-agent communication bus: Redis pub/sub for live signals,
// Postgres agent_messages for durable inbox + audit.
const { redis, makeConnection } = require("./redis.cjs");
const db = require("./db.cjs");
const log = require("./logger.cjs").make("bus");

const CHANNEL = (brandId) => `aiteam:bus:${brandId}`;

/** publish a message from one agent to another (or broadcast). */
async function publish(msg) {
  const m = {
    brand_id: msg.brandId,
    from_agent: msg.from,
    to_agent: msg.to || "broadcast",
    topic: msg.topic,
    payload: msg.payload || {},
    ts: new Date().toISOString(),
  };
  // durable — authoritative; throws if DB is down so callers know the message was not saved
  await db.query(
    `insert into ait_agent_messages (brand_id, from_agent, to_agent, topic, payload)
     values ($1,$2,$3,$4,$5)`,
    [m.brand_id, m.from_agent, m.to_agent, m.topic, m.payload]
  );
  // live — Redis is best-effort; a blip here does not lose the message (it's in Postgres)
  try {
    await redis.publish(CHANNEL(m.brand_id), JSON.stringify(m));
  } catch (e) {
    log.warn("live bus publish failed (message persisted in DB)", e.message);
  }
  return m;
}

/** subscribe to bus messages for a brand. handler(msg). */
function subscribe(brandId, handler) {
  const sub = makeConnection();
  sub.subscribe(CHANNEL(brandId), (err) => {
    if (err) log.error("subscribe failed", err.message);
    else log.info(`subscribed bus for brand=${brandId}`);
  });
  sub.on("message", (_ch, raw) => {
    try {
      handler(JSON.parse(raw));
    } catch (e) {
      log.warn("bad bus message", e.message);
    }
  });
  return sub;
}

module.exports = { publish, subscribe };

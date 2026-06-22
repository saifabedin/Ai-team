"use strict";
const IORedis = require("ioredis");
const config = require("./config.cjs");
const log = require("./logger.cjs").make("redis");

// BullMQ requires maxRetriesPerRequest: null.
function makeConnection() {
  const conn = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    // Back off on reconnect (50ms..2s) instead of hammering a down Redis.
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });
  // Without an 'error' listener ioredis throws "Unhandled error event" and can
  // crash the process on a transient ECONNREFUSED. Log + let retryStrategy reconnect.
  conn.on("error", (e) => log.warn("[redis]", e.code || e.message));
  return conn;
}

// Shared general-purpose client (cache, pubsub publish).
const redis = makeConnection();

module.exports = { redis, makeConnection };

'use strict';
const Redis = require('ioredis');

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  retryStrategy: () => null, // არ ვცადოთ reconnect — თუ Redis არ არის, უბრალოდ გამოვტოვოთ
  lazyConnect: true,
});

redis.on('error', () => {}); // silently ignore

const cache = {
  async get(key) {
    try {
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },

  async set(key, value, ttlSeconds = 3600) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {}
  },

  async del(key) {
    try { await redis.del(key); } catch {}
  },

  async flush(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length) await redis.del(...keys);
    } catch {}
  }
};

// TTL constants
cache.TTL = {
  VIN: 86400,        // 24 საათი — VIN decode
  OEM: 3600,         // 1 საათი — OEM lookup
  COMPAT: 604800,    // 7 დღე — compatibility result
  SEARCH: 300,       // 5 წუთი — search results
  VEHICLE: 86400,    // 24 საათი — vehicle list
  CROSS: 3600,       // 1 საათი — cross references
};

module.exports = cache;

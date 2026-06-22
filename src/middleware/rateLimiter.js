'use strict';
const rateLimit = require('express-rate-limit');
const RateLimitRedisModule = require('rate-limit-redis');
const RedisStore = RateLimitRedisModule.RedisStore || RateLimitRedisModule.default || RateLimitRedisModule;
const Redis = require('ioredis');

const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
redisClient.on('error', (err) => console.error('[rateLimiter] Redis error:', err.message));

function makeLimiter({ windowMs, max, prefix }) {
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `rl:${prefix}:`,
    }),
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = {
  apiLimiter:      makeLimiter({ windowMs: 15*60*1000, max: 300, prefix: 'api' }),
  loginLimiter:    makeLimiter({ windowMs: 15*60*1000, max: 10,  prefix: 'login' }),
  registerLimiter: makeLimiter({ windowMs: 15*60*1000, max: 5,   prefix: 'register' }),
  aiLimiter:       makeLimiter({ windowMs: 15*60*1000, max: 15,  prefix: 'ai' }),
  vinOcrLimiter:   makeLimiter({ windowMs: 15*60*1000, max: 15,  prefix: 'vinocr' }),
  vinBatchLimiter: makeLimiter({ windowMs: 60*60*1000, max: 10,  prefix: 'vinbatch' }),
};

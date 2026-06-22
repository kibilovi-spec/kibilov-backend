'use strict';
require('dotenv').config();
const Sentry = require('@sentry/node');
Sentry.init({
  dsn: process.env.SENTRY_DSN_BACKEND,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1,
});
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const cron         = require('node-cron');
const path         = require('path');
const { syncFromFina } = require('./services/fina');

const app  = express();
app.set("trust proxy", 1);
const http = require('http');
const { Server } = require('socket.io');
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ['https://kibilov.ge', 'http://localhost:3002'], credentials: true }
});
io.on('connection', (socket) => {
  socket.on('join-admin', () => socket.join('admin'));
});
global.io = io;
const PORT = process.env.PORT || 3001;
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'https://kibilov.ge',
    'https://www.kibilov.ge',
  ],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
// BigInt serialization fix
const origJson = JSON.stringify;
JSON.stringify = function(value, replacer, space) {
  return origJson(value, (key, val) => {
    if (typeof val === 'bigint') return Number(val);
    return replacer ? (typeof replacer === 'function' ? replacer(key, val) : val) : val;
  }, space);
};
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Static Files (product images) ─────────────────────────────────────────────
const uploadsDir = process.env.UPLOADS_DIR
  || path.join(__dirname, '../../uploads');

app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=604800');
  },
}));

// ── Rate limiting ──────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), ts: new Date().toISOString() });
});

const { apiLimiter, loginLimiter, registerLimiter, aiLimiter, vinOcrLimiter, vinBatchLimiter } = require('./middleware/rateLimiter');

app.use('/api/', apiLimiter);
app.use('/api/auth/login',    loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/ai/chat',       aiLimiter);
app.use('/api/ai/scan',       aiLimiter);
app.use('/api/vin/ocr',       vinOcrLimiter);
app.use('/api/vin/batch',     vinBatchLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/cart',       require('./routes/cart'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/delivery',   require('./routes/delivery'));
app.use('/api/payment',    require('./routes/payment'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/kits', require('./routes/kits'));
app.use('/api/telegram', require('./routes/telegram_bot'));
app.use('/api/wishlist',  require('./routes/wishlist'));
app.use('/api/autodoc-search',    require('./routes/autodoc_search'));
app.use('/api/ai',        require('./routes/ai'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/garage', require('./routes/garage'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/supplier',  require('./routes/supplier'));
app.use('/api/fina',       require('./routes/fina'));
app.use('/api/contact',    require('./routes/contact'));
app.use('/api/parts', require('./routes/parts'));
app.use('/api/garages', require('./routes/garages'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin2'));
app.use('/api/vin',   require('./routes/vin'));

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', async (_, res) => {
  const checks = { db: false, redis: false };
  try {
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    await p.$queryRaw`SELECT 1`;
    await p.$disconnect();
    checks.db = true;
  } catch(e) { console.error('DB health check:', e.message); }
  try {
    const cache = require('./services/cache');
    await cache.set('health:ping', '1', 5);
    checks.redis = true;
  } catch {}
  res.json({
    status: checks.db ? 'ok' : 'degraded',
    service: 'Kibilov API',
    uptime: Math.round(process.uptime()),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    checks,
    ts: new Date().toISOString()
  });
});

app.use("/api/reference", require("./routes/reference"));
app.use("/api/autodoc", require("./routes/autodoc"));
app.use("/api/search-debug", require("./routes/search_debug"));
app.use("/api/catalog", require("./routes/vehicles_catalog"));
app.use("/api/catalog", require("./routes/catalog"));

// Analytics visit tracking
app.post("/api/analytics/visit", async (req, res) => {
  try {
    const { sessionId, path: visitPath, referrer } = req.body;
    if (!sessionId) return res.json({ ok: false });
    const cache = require('./services/cache');
    const { PrismaClient } = require('@prisma/client');
    const _prisma = global._visitPrisma || (global._visitPrisma = new PrismaClient());
    const dateStr = new Date().toISOString().split('T')[0];
    const key = `visit:${sessionId}:${dateStr}`;
    const exists = await cache.get(key);
    if (!exists) {
      await cache.set(key, '1', 1800);
      await _prisma.$executeRaw`
        INSERT INTO site_visits (session_id, path, referrer)
        VALUES (${sessionId}, ${visitPath||'/'}, ${referrer||null})
      `;
    }
    res.json({ ok: true });
  } catch(e) { console.error('visit error:', e.message); res.json({ ok: false, error: e.message }); }
});
app.use("/api/leads", require("./routes/leads"));
app.use("/api/bulk", require("./routes/bulk"));
app.use('/api/reviews', require('./routes/reviews'));
// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('❌', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message,
  });
});

// ── FINA Cron (every 30 min) ───────────────────────────────────────────────────
if (process.env.FINA_API_KEY) {
  cron.schedule(process.env.FINA_SYNC_INTERVAL || '*/30 * * * *', async () => {
    console.log('🔄 FINA sync started...');
    try {
      const result = await syncFromFina();
      console.log(`✅ FINA sync: ${result.synced} items`);
    } catch (e) {
      console.error('❌ FINA sync failed:', e.message);
    }
  });
}

httpServer.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   🚘 Kibilov AutoParts — API Server      ║');
  console.log(`║   http://localhost:${PORT}                 ║`);
  console.log(`║   ENV: ${(process.env.NODE_ENV||'development').padEnd(34)}║`);
  console.log(`║   Uploads: ${uploadsDir.slice(-30).padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════╝');
});

// Global error handler — never return null/crash
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', req.method, req.path, err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({
    type: 'error',
    message: 'სერვერის შეცდომა. გთხოვთ სცადეთ თავიდან.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use('/api/payout', require('./routes/payout'));
module.exports = app;


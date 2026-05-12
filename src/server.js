'use strict';
require('dotenv').config();
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
const PORT = process.env.PORT || 3001;

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
app.use(express.json({ limit: '2mb' }));
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
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/login',    rateLimit({ windowMs: 15*60*1000, max: 10 }));
app.use('/api/auth/register', rateLimit({ windowMs: 15*60*1000, max: 5  }));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/cart',       require('./routes/cart'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/delivery',   require('./routes/delivery'));
app.use('/api/payment',    require('./routes/payment'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/fina',       require('./routes/fina'));

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({
  status: 'ok', service: 'Kibilov API', uptime: process.uptime(), ts: new Date().toISOString()
}));

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

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   🚘 Kibilov AutoParts — API Server      ║');
  console.log(`║   http://localhost:${PORT}                 ║`);
  console.log(`║   ENV: ${(process.env.NODE_ENV||'development').padEnd(34)}║`);
  console.log(`║   Uploads: ${uploadsDir.slice(-30).padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════╝');
});

module.exports = app;

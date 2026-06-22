const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

function getWebPush() {
  const webpush = require('web-push');
  webpush.setVapidDetails(
    'mailto:admin@kibilov.ge',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return webpush;
}

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'subscription required' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/send', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'admin only' });
    const { subscription, title, body, url } = req.body;
    const webpush = getWebPush();
    await webpush.sendNotification(JSON.parse(subscription), JSON.stringify({ title, body, url }));
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

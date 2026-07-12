'use strict';
// Flitt merchant-ის აქტივაციის ერთჯერადი შემოწმება + Telegram შეტყობინება.
// ყოველდღე cron-ით ეშვება, მაგრამ როცა ერთხელ დაადასტურებს აქტივაციას,
// ქმნის flag-ფაილს და მომავალში საერთოდ აღარაფერს აკეთებს (არც შემოწმებას,
// არც შეტყობინებას) — ესეიგი ზუსტად ერთხელ გამოგზავნის, არასდროს გაიმეორებს.
require('dotenv').config();
const fs = require('fs');
const https = require('https');
const CloudIpsp = require('cloudipsp-node-js-sdk');

const FLAG_FILE = '/var/www/kibilov-backend/scripts/.flitt-activated.flag';

// უკვე დადასტურებულია ადრე — აღარაფერი გასაკეთებელი
if (fs.existsSync(FLAG_FILE)) {
  console.log(`[${new Date().toISOString()}] Flitt უკვე დადასტურებული იყო ადრე — აღარაფერს ვამოწმებ.`);
  process.exit(0);
}

function sendTelegram(text) {
  return new Promise((resolve) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const data = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => { res.on('data', () => {}); res.on('end', resolve); });
    req.on('error', resolve);
    req.write(data);
    req.end();
  });
}

const flitt = new CloudIpsp({
  merchantId: Number(process.env.FLITT_MERCHANT_ID),
  secretKey: process.env.FLITT_SECRET_KEY,
});

flitt.Checkout({
  order_id: 'auto-check-' + Date.now(),
  order_desc: 'Merchant activation auto-check',
  currency: 'GEL',
  amount: '100',
}).then(async (r) => {
  console.log(`[${new Date().toISOString()}] ✅ Flitt გააქტიურდა! checkout_url: ${r.checkout_url}`);
  await sendTelegram('🎉 *Flitt Merchant გააქტიურდა\\!*\\n\\nგადახდები ახლა რეალურად მუშაობს kibilov\\.ge\\-ზე\\. ეს არის ბოლო ავტომატური შეტყობინება ამ თემაზე\\.');
  fs.writeFileSync(FLAG_FILE, new Date().toISOString());
  console.log('Flag-ფაილი შეიქმნა — მომავალში ეს script აღარაფერს გააკეთებს.');
}).catch((e) => {
  const msg = e.message || JSON.stringify(e);
  console.log(`[${new Date().toISOString()}] ⏳ ჯერ არ არის აქტიური: ${msg}`);
});

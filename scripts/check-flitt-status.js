'use strict';
// Flitt merchant-ის აქტივაციის სტატუსის სწრაფი შემოწმება.
// გაშვება: node scripts/check-flitt-status.js
// "Merchant not found" ნიშნავს — ჯერ არ არის აქტიური.
// წარმატებული checkout_url ნიშნავს — Flitt-ი მზადაა და გადახდები იმუშავებს.
require('dotenv').config();
const CloudIpsp = require('cloudipsp-node-js-sdk');

const flitt = new CloudIpsp({
  merchantId: Number(process.env.FLITT_MERCHANT_ID),
  secretKey: process.env.FLITT_SECRET_KEY,
});

console.log(`[${new Date().toISOString()}] Flitt merchant-ის სტატუსის შემოწმება...`);

flitt.Checkout({
  order_id: 'status-check-' + Date.now(),
  order_desc: 'Merchant status check',
  currency: 'GEL',
  amount: '100',
}).then(r => {
  console.log('✅ Flitt აქტიურია! checkout_url:', r.checkout_url);
  console.log('🎉 გადახდები ახლა რეალურად იმუშავებს საიტზე.');
}).catch(e => {
  const msg = e.message || JSON.stringify(e);
  if (msg.includes('Merchant not found')) {
    console.log('⏳ ჯერ არ არის აქტიური — "Merchant not found". სცადეთ ხვალ ხელახლა.');
  } else {
    console.log('❌ სხვა შეცდომა:', msg);
  }
});

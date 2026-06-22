'use strict';
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE = `https://api.telegram.org/bot${TOKEN}`;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sessions = new Map();

async function sendMessage(chatId, text) {
  try {
    await axios.post(`${BASE}/sendMessage`, { chat_id: chatId, text, parse_mode: 'HTML' });
  } catch(e) { console.error('TG send error:', e.message); }
}

async function searchProducts(query) {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { nameKa: { contains: query, mode: 'insensitive' } },
          { nameEn: { contains: query, mode: 'insensitive' } },
        ]
      },
      take: 5,
      select: { id: true, nameKa: true, price: true, stock: true }
    });
    await prisma.$disconnect();
    return products;
  } catch(e) { return []; }
}

router.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const { message } = req.body;
    if (!message) return;
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from?.first_name || 'მომხმარებელი';

    if (text === '/start') {
      sessions.delete(chatId);
      await sendMessage(chatId, `🚗 <b>გამარჯობა ${firstName}!</b>\n\nმე ვარ Kibilov AutoParts-ის AI ასისტენტი.\n\nმომწერე ნაწილის სახელი ან მანქანა + ნაწილი:\n<code>Golf 6 ხუნდი</code>\n<code>W204 ამორტიზატორი</code>\n\n📱 kibilov.ge | 📞 +995 577 575 052`);
      return;
    }

    await axios.post(`${BASE}/sendChatAction`, { chat_id: chatId, action: 'typing' }).catch(() => {});

    if (!sessions.has(chatId)) sessions.set(chatId, []);
    const history = sessions.get(chatId);
    history.push({ role: 'user', content: text });
    if (history.length > 10) history.splice(0, 2);

    const aiResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `შენ ხარ Kibilov AutoParts-ის AI ასისტენტი Telegram-ში.
თუ მომხმარებელი ეძებს ნაწილს, დაბრუნე მხოლოდ JSON: {"search":"საძიებო სიტყვა","make":"მარკა","model":"მოდელი"}
სხვა შემთხვევაში პირდაპირ უპასუხე ქართულად, მოკლედ.
საიტი: kibilov.ge | ტელ: +995 577 575 052`,
      messages: history
    });

    const aiText = aiResponse.content[0].text;
    history.push({ role: 'assistant', content: aiText });

    let replied = false;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*"search"[\s\S]*\}/);
      if (jsonMatch) {
        const intent = JSON.parse(jsonMatch[0]);
        const products = await searchProducts(intent.search);
        if (products.length > 0) {
          let msg = `🔍 <b>${intent.make || ''} ${intent.model || ''} — ${intent.search}</b>\n\n`;
          for (const p of products) {
            msg += `• <b>${p.nameKa}</b>\n  💰 ${parseFloat(p.price).toFixed(2)}₾ | ${p.stock > 0 ? '✅ მარაგშია' : '❌ არ არის'}\n  🔗 kibilov.ge/products/${p.id}\n\n`;
          }
          msg += `📱 <a href="https://wa.me/995577575052">WhatsApp-ით შეკვეთა</a>`;
          await sendMessage(chatId, msg);
        } else {
          await sendMessage(chatId, `😔 <b>${intent.search}</b> — ამ მომენტში მარაგში არ გვაქვს.\n📞 <a href="https://wa.me/995577575052">შეგვიძლია შეგიკვეთოთ</a>`);
        }
        replied = true;
      }
    } catch(e) {}

    if (!replied) await sendMessage(chatId, aiText);

  } catch(e) { console.error('TG bot error:', e.message); }
});

router.get('/set-webhook', async (req, res) => {
  try {
    const url = 'https://kibilov.ge/api/telegram/webhook';
    const r = await axios.post(`${BASE}/setWebhook`, { url });
    res.json({ success: true, result: r.data });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

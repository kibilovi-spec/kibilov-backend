require('dotenv').config();
const { checkEmails } = require('../src/services/emailImporter');
const { importSupplierExcelBuffer } = require('../src/services/supplierExcelImport');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const axios = require('axios');
const TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID;

async function notify(msg) {
  if (!TELEGRAM_BOT || !TELEGRAM_CHAT) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
      chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML'
    });
  } catch (e) { console.error('[Telegram] Error:', e.message); }
}

function extractEmail(fromField) {
  const m = (fromField || '').match(/<(.+?)>/);
  return (m ? m[1] : (fromField || '')).toLowerCase().trim();
}

async function run() {
  console.log(`[EmailImport] Checking at ${new Date().toISOString()}`);
  try {
    const attachments = await checkEmails();
    if (!attachments.length) {
      console.log('[EmailImport] No new files');
      return;
    }
    for (const att of attachments) {
      console.log(`[EmailImport] Found: ${att.filename} from ${att.from}`);
      const fromEmail = extractEmail(att.from);
      const supplier = await prisma.supplier.findFirst({ where: { user: { email: fromEmail } } });
      if (!supplier) {
        await notify(`⚠️ <b>Email Import</b>\nუცნობი გამომგზავნი: ${fromEmail}\nფაილი: ${att.filename}\nSupplier ვერ მოიძებნა ამ email-ით.`);
        try { fs.unlinkSync(att.filePath); } catch(e) {}
        continue;
      }
      try {
        const buffer = fs.readFileSync(att.filePath);
        const result = await importSupplierExcelBuffer(supplier.id, buffer, 'EMAIL', att.filename);
        await notify(
          `📧 <b>Email Import — ${supplier.companyName}</b>\n` +
          `ფაილი: ${att.filename}\n` +
          `დაემატა: ${result.added}, განახლდა: ${result.updated}, გამოტოვდა: ${result.skipped}`
        );
      } catch (e) {
        await notify(`❌ <b>Email Import Error</b> (${supplier.companyName}): ${e.message}`);
      } finally {
        try { fs.unlinkSync(att.filePath); } catch(e) {}
      }
    }
  } catch (e) {
    console.error('[EmailImport] Error:', e.message);
    await notify(`❌ Email Import Error: ${e.message}`);
  }
}
run().then(() => process.exit(0));

'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createNotification } = require('./supplierNotify');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

const checkStockAlerts = async () => {
  try {
    const lowStock = await prisma.$queryRaw`
      SELECT pl.*, s.id as "supplierId", s."companyName", u.email as "supplierEmail"
      FROM product_listings pl
      JOIN suppliers s ON s.id=pl."supplierId"
      JOIN users u ON u.id=s."userId"
      WHERE pl.stock > 0 AND pl.stock <= 3
      AND pl.status IN ('APPROVED','ACTIVE')
      AND NOT EXISTS (
        SELECT 1 FROM supplier_notifications sn
        WHERE sn."supplierId"=s.id
        AND sn.type='STOCK_ALERT'
        AND sn.message LIKE '%' || pl.sku || '%'
        AND sn."createdAt" > NOW() - INTERVAL '24 hours'
      )`;

    for (const item of lowStock) {
      await createNotification(
        item.supplierId,
        'STOCK_ALERT',
        '⚠️ მარაგი მცირდება',
        `${item.nameKa} (${item.sku}) — მარაგი: ${item.stock} ცალი`,
        '/supplier/listings'
      );
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: item.supplierEmail,
        subject: `⚠️ მარაგი მცირდება — ${item.nameKa}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1a2744;padding:20px;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:22px">🚗 Kibilov AutoParts</h1>
            </div>
            <div style="padding:24px">
              <h2 style="color:#d97706">⚠️ მარაგი მცირდება!</h2>
              <p>გამარჯობა, <strong>${item.companyName}</strong>!</p>
              <p>პროდუქტი <strong>${item.nameKa}</strong> (SKU: ${item.sku})-ს მარაგი <strong>${item.stock} ცალამდე</strong> შემცირდა.</p>
              <p>გთხოვთ განაახლოთ მარაგი.</p>
              <a href="https://kibilov.ge/supplier/listings" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">მარაგის განახლება</a>
            </div>
          </div>`
      }).catch(()=>{});
    }
    if (lowStock.length > 0) console.log(`[stockAlert] ${lowStock.length} alert sent`);
  } catch(e) { console.error('[stockAlert]', e.message); }
};

module.exports = { checkStockAlerts };

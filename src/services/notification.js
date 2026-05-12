'use strict';
const nodemailer = require('nodemailer');

// ─── WhatsApp via Twilio ───────────────────────────────────────────────────
async function sendWhatsApp(to, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('[WhatsApp MOCK]', to, body.slice(0, 80));
    return;
  }
  try {
    const client = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${to}`,
      body,
    });
  } catch (e) {
    console.error('[WhatsApp Error]', e.message);
  }
}

// ─── Email via Nodemailer ──────────────────────────────────────────────────
function getTransporter() {
  if (!process.env.SMTP_HOST) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('[Email MOCK] To:', to, '| Subject:', subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Kibilov AutoParts" <${process.env.SMTP_USER}>`,
      to, subject, html, text,
    });
  } catch (e) {
    console.error('[Email Error]', e.message);
  }
}

// ─── Order notifications ───────────────────────────────────────────────────
async function notifyNewOrder(order) {
  const adminPhone = process.env.ADMIN_WHATSAPP_PHONE;
  const adminEmail = process.env.ADMIN_EMAIL;
  const items = order.items?.map(i => `  • ${i.name} x${i.qty} — ${i.price}₾`).join('\n') || '';
  const waMsg =
`🛒 *ახალი შეკვეთა #${order.id.slice(-6).toUpperCase()}*
👤 ${order.customerName} | 📞 ${order.customerPhone}
📦 ნივთები:
${items}
💰 სულ: ${order.total}₾ (მიტანა: ${order.deliveryFee}₾)
💳 გადახდა: ${order.paymentMethod}
📍 ზონა: ${order.deliveryZone}`;

  const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1565C0;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0">🛒 ახალი შეკვეთა #${order.id.slice(-6).toUpperCase()}</h2>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <p><strong>მომხმარებელი:</strong> ${order.customerName}</p>
    <p><strong>ტელეფონი:</strong> ${order.customerPhone}</p>
    <p><strong>Email:</strong> ${order.customerEmail || '—'}</p>
    <p><strong>ზონა:</strong> ${order.deliveryZone}</p>
    <p><strong>გადახდა:</strong> ${order.paymentMethod}</p>
    <hr style="margin:15px 0"/>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f4f6f9"><th style="padding:8px;text-align:left">პროდუქტი</th><th>რ-ბა</th><th>ფასი</th></tr>
      ${order.items?.map(i => `<tr><td style="padding:8px">${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${i.price}₾</td></tr>`).join('')}
    </table>
    <hr style="margin:15px 0"/>
    <p style="font-size:18px;font-weight:bold">სულ: ${order.total}₾</p>
  </div>
</div>`;

  await Promise.all([
    adminPhone ? sendWhatsApp(adminPhone, waMsg) : Promise.resolve(),
    adminEmail ? sendEmail({ to: adminEmail, subject: `შეკვეთა #${order.id.slice(-6).toUpperCase()} — Kibilov AutoParts`, html: emailHtml }) : Promise.resolve(),
    order.customerEmail ? sendEmail({
      to: order.customerEmail,
      subject: `თქვენი შეკვეთა #${order.id.slice(-6).toUpperCase()} მიღებულია`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1565C0;padding:20px;border-radius:8px 8px 0 0"><h2 style="color:#fff;margin:0">გმადლობთ შეკვეთისთვის!</h2></div><div style="border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 8px 8px"><p>შეკვეთა <strong>#${order.id.slice(-6).toUpperCase()}</strong> წარმატებით მიღებულია.</p><p>ჩვენ მალე დაგიკავშირდებით დასადასტურებლად.</p><p style="margin-top:20px;color:#666;font-size:13px">kibilov.ge | +995 XXX XXX XXX</p></div></div>`,
    }) : Promise.resolve(),
  ]);
}

async function notifyStatusChange(order, newStatus) {
  if (!order.customerEmail && !order.customerPhone) return;
  const labels = {
    CONFIRMED:  'დადასტურებულია ✅',
    PROCESSING: 'მუშავდება 🔧',
    SHIPPED:    'გაიგზავნა 🚚',
    DELIVERED:  'ჩაბარებულია 🎉',
    CANCELLED:  'გაუქმებულია ❌',
  };
  const label = labels[newStatus] || newStatus;
  if (order.customerPhone && process.env.ADMIN_WHATSAPP_PHONE) {
    await sendWhatsApp(order.customerPhone,
      `📦 შეკვეთა #${order.id.slice(-6).toUpperCase()}: ${label}\nkibilov.ge`);
  }
  if (order.customerEmail) {
    await sendEmail({
      to: order.customerEmail,
      subject: `შეკვეთა #${order.id.slice(-6).toUpperCase()}: ${label}`,
      html: `<p>თქვენი შეკვეთის სტატუსი განახლდა: <strong>${label}</strong></p>`,
    });
  }
}

module.exports = { sendWhatsApp, sendEmail, notifyNewOrder, notifyStatusChange };

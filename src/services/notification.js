const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const sendTelegram = async (message) => {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
  } catch(e) { console.error('Telegram error:', e.message); }
};

const notifyNewOrder = async (order, user) => {
  const items = order.items?.map(i => `• ${i.product?.nameKa||i.productId} × ${i.quantity} — ${parseFloat(i.price).toFixed(2)}₾`).join('\n') || '';
  await sendTelegram(`🛒 <b>ახალი შეკვეთა #${order.id.slice(-6)}</b>
👤 ${user?.name || 'სტუმარი'}
📱 ${user?.phone || '—'}
📦 ${items}
💰 სულ: <b>${parseFloat(order.total).toFixed(2)}₾</b>`);
};

const notifyNewUser = async (user) => {
  await sendTelegram(`👤 <b>ახალი მომხმარებელი</b>
სახელი: ${user.name}
Email: ${user.email}
ტელ: ${user.phone || '—'}`);
};

const notifyB2BRequest = async (user) => {
  await sendTelegram(`🏢 <b>B2B მოთხოვნა</b>
${user.name} (${user.email})
ტელ: ${user.phone || '—'}`);
};

const notifyLowStock = async (product) => {
  await sendTelegram(`⚠️ <b>დაბალი მარაგი</b>
${product.nameKa} (${product.sku})
მარაგი: ${product.stock} ცალი`);
};

const notifyNewSupplier = async (supplier, user) => {
  // Telegram
  await sendTelegram(`🏪 <b>ახალი მომწოდებელი</b>
🏢 ${supplier.companyName}
👤 ${supplier.contactName}
📞 ${supplier.phone}
📧 ${user.email}
🆔 ${supplier.taxId||'—'}
📍 ${supplier.address||'—'}
⏳ სტატუსი: განხილვაში`);

  // Email to admin
  try {
    const { sendEmail } = require('./email');
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: '🏪 ახალი მომწოდებელი — ' + supplier.companyName,
      html: `<h2>ახალი მომწოდებლის განაცხადი</h2>
        <p><b>კომპანია:</b> ${supplier.companyName}</p>
        <p><b>საკონტაქტო:</b> ${supplier.contactName}</p>
        <p><b>ტელეფონი:</b> ${supplier.phone}</p>
        <p><b>Email:</b> ${user.email}</p>
        <p><b>საიდ. კოდი:</b> ${supplier.taxId||'—'}</p>
        <p><b>მისამართი:</b> ${supplier.address||'—'}</p>
        <br><a href="https://kibilov.ge/admin/suppliers">Admin პანელზე გადასვლა →</a>`
    });
  } catch(e) { console.error('Supplier email error:', e.message); }

  // Confirmation email to supplier
  try {
    const { sendEmail } = require('./email');
    await sendEmail({
      to: user.email,
      subject: '✅ თქვენი განაცხადი მიღებულია — kibilov.ge',
      html: `<h2>გამარჯობა, ${supplier.contactName}!</h2>
        <p>თქვენი მომწოდებლის განაცხადი <b>წარმატებით მიღებულია</b>.</p>
        <p>ჩვენი გუნდი განიხილავს 24 საათის განმავლობაში და დაგიკავშირდებათ.</p>
        <br>
        <p>კომპანია: <b>${supplier.companyName}</b></p>
        <br>
        <p>პატივისცემით,<br>kibilov.ge გუნდი</p>`
    });
  } catch(e) { console.error('Supplier confirm email error:', e.message); }
};

module.exports = { sendTelegram, notifyNewOrder, notifyNewUser, notifyB2BRequest, notifyLowStock, notifyNewSupplier };

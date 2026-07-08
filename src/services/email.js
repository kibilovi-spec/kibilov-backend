const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOrderConfirmation = async (order, userEmail) => {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.product?.nameKa || item.nameKa || 'პროდუქტი'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${item.price} ₾</td>
    </tr>
  `).join('');

  const total = order.items.reduce((sum, i) => sum + (Number(i.price) * i.qty), 0);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: userEmail,
    subject: `შეკვეთა #${order.id.slice(0,8).toUpperCase()} დადასტურდა — Kibilov AutoParts`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a2744;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">🚗 Kibilov AutoParts</h1>
        </div>
        <div style="padding:24px">
          <h2 style="color:#1a2744">შეკვეთა მიღებულია!</h2>
          <p>გამარჯობა! თქვენი შეკვეთა <strong>#${order.id.slice(0,8).toUpperCase()}</strong> წარმატებით დადასტურდა.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:8px;text-align:left">პროდუქტი</th>
                <th style="padding:8px;text-align:center">რაოდენობა</th>
                <th style="padding:8px;text-align:right">ფასი</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:8px;font-weight:bold">სულ:</td>
                <td style="padding:8px;text-align:right;font-weight:bold">${total.toFixed(2)} ₾</td>
              </tr>
            </tfoot>
          </table>
          <p style="color:#666">კითხვების შემთხვევაში დაგვიკავშირდით: <a href="tel:+995577575052">+995 577 575 052</a></p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#999;font-size:12px">
          kibilov.ge | რუსთავი / თბილისი
        </div>
      </div>
    `
  });
};

const sendOrderStatusUpdate = async (order, userEmail, newStatus) => {
  const statusMap = {
    CONFIRMED: { ka: 'დადასტურდა', emoji: '✅' },
    DELIVERED:  { ka: 'მიწოდებულია', emoji: '🚚' },
    CANCELLED:  { ka: 'გაუქმდა', emoji: '❌' },
  };
  const s = statusMap[newStatus] || { ka: newStatus, emoji: '📦' };

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: userEmail,
    subject: `${s.emoji} შეკვეთა #${order.id.slice(0,8).toUpperCase()} — ${s.ka}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a2744;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">🚗 Kibilov AutoParts</h1>
        </div>
        <div style="padding:24px">
          <h2 style="color:#1a2744">${s.emoji} შეკვეთის სტატუსი განახლდა</h2>
          <p>შეკვეთა <strong>#${order.id.slice(0,8).toUpperCase()}</strong> სტატუსი: <strong>${s.ka}</strong></p>
          <p style="color:#666">კითხვების შემთხვევაში: <a href="tel:+995577575052">+995 577 575 052</a></p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#999;font-size:12px">
          kibilov.ge | რუსთავი / თბილისი
        </div>
      </div>
    `
  });
};


const sendSupplierListingApproved = async (supplierEmail, companyName, listingName) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: supplierEmail,
    subject: '✅ თქვენი პროდუქტი დამტკიცდა — Kibilov AutoParts',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a2744;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">🚗 Kibilov AutoParts</h1>
        </div>
        <div style="padding:24px">
          <h2 style="color:#1a2744">✅ პროდუქტი დამტკიცდა!</h2>
          <p>გამარჯობა, <strong>${companyName}</strong>!</p>
          <p>თქვენი პროდუქტი <strong>${listingName}</strong> დამტკიცდა და საიტზე გამოჩნდა.</p>
          <a href="https://kibilov.ge/supplier/listings" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">განთავსებების ნახვა</a>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#999;font-size:12px">
          kibilov.ge | რუსთავი / თბილისი
        </div>
      </div>
    `
  });
};

const sendSupplierListingRejected = async (supplierEmail, companyName, listingName) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: supplierEmail,
    subject: '❌ პროდუქტი უარყოფილია — Kibilov AutoParts',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a2744;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">🚗 Kibilov AutoParts</h1>
        </div>
        <div style="padding:24px">
          <h2 style="color:#dc2626">❌ პროდუქტი უარყოფილია</h2>
          <p>გამარჯობა, <strong>${companyName}</strong>!</p>
          <p>სამწუხაროდ, პროდუქტი <strong>${listingName}</strong> ვერ დამტკიცდა.</p>
          <p style="color:#666">შეგიძლიათ შეასწოროთ და ხელახლა გამოაგზავნოთ.</p>
          <a href="https://kibilov.ge/supplier/listings" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">განთავსებების რედაქტირება</a>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#999;font-size:12px">
          kibilov.ge | რუსთავი / თბილისი
        </div>
      </div>
    `
  });
};

const sendSupplierApproved = async (supplierEmail, companyName) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: supplierEmail,
    subject: '🎉 მომწოდებლის ანგარიში დამტკიცდა — Kibilov AutoParts',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a2744;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">🚗 Kibilov AutoParts</h1>
        </div>
        <div style="padding:24px">
          <h2 style="color:#1a2744">🎉 კეთილი იყოს თქვენი მობრძანება!</h2>
          <p>გამარჯობა, <strong>${companyName}</strong>!</p>
          <p>თქვენი მომწოდებლის ანგარიში დამტკიცდა. ახლა შეგიძლიათ პროდუქტების განთავსება დაიწყოთ.</p>
          <a href="https://kibilov.ge/supplier/listings" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">პროდუქტის დამატება</a>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#999;font-size:12px">
          kibilov.ge | რუსთავი / თბილისი
        </div>
      </div>
    `
  });
};

module.exports = { sendOrderConfirmation, sendOrderStatusUpdate, sendOrderInvoice: sendOrderConfirmation, sendSupplierListingApproved, sendSupplierListingRejected, sendSupplierApproved };

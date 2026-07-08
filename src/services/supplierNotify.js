'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createNotification = async (supplierId, type, title, message, url=null) => {
  try {
    await prisma.$queryRaw`
      INSERT INTO supplier_notifications (id, "supplierId", type, title, message, url, "isRead", "createdAt")
      VALUES (gen_random_uuid()::text, ${supplierId}, ${type}, ${title}, ${message}, ${url}, false, NOW())
    `;
  } catch(e) { console.error('[notify]', e.message); }
};

module.exports = { createNotification };

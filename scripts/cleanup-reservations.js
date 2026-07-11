'use strict';
// ვადაგასული, დაუდასტურებელი stock-ჯავშნების გასუფთავება.
// ეს ავტომატურად ათავისუფლებს stock-ს, თუ მომხმარებელმა კალათაში
// დარჩენილი ნივთი 10-45 წუთში (tier-ის მიხედვით) არ შეიძინა.
require('dotenv').config({ path: '/var/www/kibilov-backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const result = await prisma.stockReservation.deleteMany({
      where: { confirmed: false, expiresAt: { lt: new Date() } },
    });
    console.log(`[${new Date().toISOString()}] წაშლილია ${result.count} ვადაგასული ჯავშანი`);
  } catch (e) {
    console.error('[cleanup-reservations] Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();

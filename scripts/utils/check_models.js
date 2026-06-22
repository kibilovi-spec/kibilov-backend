const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const models = Object.keys(p).filter(k => !k.startsWith('_') && !k.startsWith('$'));
console.log('search/analytics:', models.filter(m => m.toLowerCase().includes('search') || m.toLowerCase().includes('analytic')));
console.log('all models:', models);
p.$disconnect();

'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Fix: ON CONFLICT on (makeId, name) also update image_url and years
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS vehicle_models_autodoc_id_idx ON vehicle_models(autodoc_model_id) WHERE autodoc_model_id IS NOT NULL
  `;
  console.log('Done');
  await prisma.$disconnect();
}
main().catch(console.error);

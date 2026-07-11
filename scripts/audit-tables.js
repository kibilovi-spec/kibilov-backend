#!/usr/bin/env node
'use strict';
// "მკვდარი" DB ცხრილების დეტექტორი — ცხრილები, რომლებიც არსებობენ ბაზაში,
// მაგრამ არსად არ არის ნახსენები backend-ის კოდში (არც Prisma client-ის
// მეშვეობით, არც raw SQL-ში).
require('dotenv').config({ path: '/var/www/kibilov-backend/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SRC_DIR = '/var/www/kibilov-backend/src';
const SCHEMA_FILE = '/var/www/kibilov-backend/prisma/schema.prisma';

function walkFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(walkFiles(full));
    else if (entry.name.endsWith('.js')) results.push(full);
  }
  return results;
}

function toCamelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

(async () => {
  const { rows } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name
  `);
  const allTables = rows.map(r => r.table_name);

  // schema.prisma-დან: table_name -> ModelName მეპინგი (@@map("table_name") + წინა model X)
  const schemaSrc = fs.readFileSync(SCHEMA_FILE, 'utf-8');
  const modelBlocks = schemaSrc.split(/^model /m).slice(1);
  const tableToModel = {};
  for (const block of modelBlocks) {
    const modelName = block.split(/\s|{/)[0];
    const mapMatch = block.match(/@@map\(['"]([^'"]+)['"]\)/);
    if (mapMatch) tableToModel[mapMatch[1]] = modelName;
  }

  const allFiles = walkFiles(SRC_DIR);
  const allSrc = allFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');

  console.log('=== "მკვდარი" (გამოუყენებელი) DB ცხრილების შემოწმება ===\n');
  let foundOrphans = false;
  for (const table of allTables) {
    const prismaAccessor = tableToModel[table] ? toCamelCase(tableToModel[table]) : null;
    const rawMentioned = allSrc.includes(table);
    const prismaMentioned = prismaAccessor ? allSrc.includes('prisma.' + prismaAccessor) : false;
    if (!rawMentioned && !prismaMentioned) {
      foundOrphans = true;
      console.log(`⚠️  ${table}${prismaAccessor ? ` (Prisma model: ${tableToModel[table]})` : ' (schema.prisma-ში არ არის აღწერილი)'}`);
    }
  }
  if (!foundOrphans) console.log('✅ ყველა ცხრილი გამოიყენება კოდში.\n');
  await pool.end();
})();

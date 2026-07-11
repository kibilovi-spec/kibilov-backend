#!/usr/bin/env node
'use strict';
// დუბლირებული route-ების დეტექტორი — ხედავს, ერთი და იგივე path ხომ არ არის
// registered ერთზე მეტ ფაილში, ერთი და იმავე mount-პრეფიქსის ქვეშ.
const fs = require('fs');
const path = require('path');
const ROOT = '/var/www/kibilov-backend';
const ROUTES_DIR = path.join(ROOT, 'src/routes');
const SERVER_FILE = path.join(ROOT, 'src/server.js');

// 1. server.js-დან ვკითხულობთ mount-პრეფიქსებს: app.use('/api/xxx', require('./routes/yyy'))
const serverSrc = fs.readFileSync(SERVER_FILE, 'utf-8');
const mountRe = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*require\(['"]\.\/routes\/([^'"]+)['"]\)/g;
const mounts = []; // { prefix, file }
let m;
while ((m = mountRe.exec(serverSrc))) {
  mounts.push({ prefix: m[1], file: m[2] + '.js' });
}

// 2. თითოეული route-ფაილიდან ვკითხულობთ router.METHOD('path', ...) ჩანაწერებს
function extractRoutes(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const src = fs.readFileSync(filePath, 'utf-8');
  const re = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]*)['"]/g;
  const out = [];
  let mm;
  while ((mm = re.exec(src))) out.push({ method: mm[1].toUpperCase(), routePath: mm[2] });
  return out;
}

// 3. ვაერთიანებთ პრეფიქსსა და route-path-ს, ვჯგუფავთ პრეფიქსის მიხედვით
const byPrefix = {};
for (const { prefix, file } of mounts) {
  const routes = extractRoutes(path.join(ROUTES_DIR, file));
  if (!byPrefix[prefix]) byPrefix[prefix] = [];
  for (const r of routes) {
    byPrefix[prefix].push({ file, method: r.method, routePath: r.routePath });
  }
}

// 4. ერთი პრეფიქსის შიგნით ვეძებთ დუბლიკატებს (იგივე method+path, სხვადასხვა ფაილი)
console.log('=== დუბლირებული Route-ების შემოწმება ===\n');
let foundDupes = false;
for (const [prefix, routes] of Object.entries(byPrefix)) {
  const seen = new Map(); // key: method+path -> [files]
  for (const r of routes) {
    const key = r.method + ' ' + r.routePath;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(r.file);
  }
  for (const [key, files] of seen) {
    const uniqueFiles = [...new Set(files)];
    if (uniqueFiles.length > 1) {
      foundDupes = true;
      console.log(`⚠️  ${prefix}${key.split(' ')[1]} (${key.split(' ')[0]}) — registered ${uniqueFiles.length} ფაილში: ${uniqueFiles.join(', ')}`);
      console.log(`    (Express-ი მხოლოდ პირველს გაუშვებს mount-თანმიმდევრობით!)\n`);
    }
  }
}
if (!foundDupes) console.log('✅ დუბლირებული route არ ნაპოვნია.\n');

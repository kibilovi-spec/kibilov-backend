require('dotenv').config({ path: '/var/www/kibilov-backend/.env' });
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const client = new Client({ connectionString: DB_URL });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function translateBatch(items) {
  const list = items.map((c, i) => `${i + 1}. [${c.autodoc_id}] ${c.name_en}`).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `თარგმნე ავტომობილის სათადარიგო ნაწილების კატეგორიები ქართულად. დაბრუნე მხოლოდ JSON მასივი ფორმატში: [{"id": autodoc_id, "ka": "ქართული სახელი"}]\n\nკატეგორიები:\n${list}\n\nწესები:\n- მოკლე და ზუსტი ტექნიკური ტერმინი\n- არ გამოიყენო ზედმეტი სიტყვები\n- ავტო ინდუსტრიის სტანდარტული ტერმინოლოგია\n- მხოლოდ JSON, სხვა არაფერი`
      }]
    })
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';
  
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error('Parse error:', text.substring(0, 200));
    return [];
  }
}

async function main() {
  await client.connect();
  console.log('Connected to DB');

  const { rows } = await client.query(`
    SELECT autodoc_id, name_en, name_ka, level
    FROM autodoc_categories
    WHERE name_ka IS NULL 
       OR name_ka = name_en
       OR name_ka ~ '^[A-Za-z]'
    ORDER BY level, autodoc_id
  `);

  console.log(`კატეგორიები თარგმანის გარეშე: ${rows.length}`);
  if (!ANTHROPIC_KEY) { console.error('ANTHROPIC_API_KEY არ არის .env-ში!'); process.exit(1); }

  const BATCH = 30;
  let translated = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    console.log(`Batch ${Math.floor(i/BATCH)+1}/${Math.ceil(rows.length/BATCH)}`);

    const results = await translateBatch(batch);

    for (const r of results) {
      if (!r.id || !r.ka) continue;
      await client.query(`UPDATE autodoc_categories SET name_ka = $1 WHERE autodoc_id = $2`, [r.ka, r.id]);
      translated++;
    }

    console.log(`  ${results.length} თარგმნილი | სულ: ${translated}`);
    if (i + BATCH < rows.length) await sleep(500);
  }

  const { rows: stats } = await client.query(`
    SELECT COUNT(*) FILTER (WHERE name_ka IS NOT NULL AND name_ka !~ '^[A-Za-z]') as has_ka, COUNT(*) as total FROM autodoc_categories
  `);
  console.log(`\nშედეგი: ${stats[0].has_ka}/${stats[0].total} კატეგორიას აქვს ქართული სახელი`);
  await client.end();
}

main().catch(console.error);

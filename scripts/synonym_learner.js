const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function learnSynonyms() {
  // 1. Top failed searches
  const failed = await prisma.$queryRaw`
    SELECT query, COUNT(*)::int as cnt
    FROM search_analytics
    WHERE results_count = 0
    AND created_at > NOW() - INTERVAL '7 days'
    GROUP BY query
    ORDER BY cnt DESC
    LIMIT 50
  `;

  console.log(`\nTop failed searches (${failed.length}):`);
  
  const suggestions = [];
  
  for (const row of failed) {
    const q = row.query;
    
    // Skip non-meaningful queries
    if (q.length < 3 || q === 'test' || q.includes('?')) continue;
    
    // Extract parts from query
    const words = q.toLowerCase().split(/\s+/);
    
    // Check if any word exists in products
    for (const word of words) {
      if (word.length < 4) continue;
      
      const found = await prisma.$queryRaw`
        SELECT COUNT(*)::int as cnt FROM products
        WHERE LOWER("nameKa") LIKE ${`%${word}%`}
        OR LOWER("nameEn") LIKE ${`%${word}%`}
        AND "isActive" = true
        LIMIT 1
      `;
      
      if (found[0]?.cnt > 0) {
        suggestions.push({
          failed_query: q,
          matching_word: word,
          count: row.cnt,
          action: `Add "${q}" → "${word}" to aliases`
        });
        break;
      }
    }
  }
  
  console.log('\nSuggested aliases:');
  suggestions.forEach(s => console.log(`  [${s.count}x] ${s.action}`));
  
  // 2. Zero-result queries that have partial matches
  console.log('\n\nZero result analysis:');
  for (const row of failed.slice(0, 10)) {
    const q = row.query;
    if (q.length < 3) continue;
    
    // Try brand+part split
    const parts = q.split(' ');
    if (parts.length >= 2) {
      const partQuery = parts[parts.length - 1]; // last word = part
      const vehicleQuery = parts.slice(0, -1).join(' '); // rest = vehicle
      
      const partFound = await prisma.$queryRaw`
        SELECT COUNT(*)::int as cnt FROM products
        WHERE LOWER("nameKa") LIKE ${`%${partQuery.toLowerCase()}%`}
        AND "isActive" = true
      `;
      
      console.log(`  "${q}" → vehicle:"${vehicleQuery}" part:"${partQuery}" (${partFound[0]?.cnt} products with part)`);
    }
  }
  
  await prisma.$disconnect();
  return suggestions;
}

learnSynonyms().catch(console.error);

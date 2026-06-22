const { enrichWithSynonyms } = require('./src/services/synonyms');

const message = 'brake pad';
const searchTerms = ['brake pad'];

const enriched = enrichWithSynonyms(searchTerms.join(' '));
enriched.forEach(t => { if (!searchTerms.includes(t)) searchTerms.push(t); });

const engToKa = {
  'brake pad': ['სამუხრუჭე ხუნდი','კალოტკა','კალოდკა'],
  'колодка': ['სამუხრუჭე ხუნდი','კალოტკა','brake pad'],
};

const msgLow = message.toLowerCase();
for (const [eng, ka] of Object.entries(engToKa)) {
  if (msgLow.includes(eng)) ka.forEach(t => { if (!searchTerms.includes(t)) searchTerms.push(t); });
}

console.log('final searchTerms:', searchTerms);

const normalizedTerms = [...new Set([
  ...searchTerms,
  ...searchTerms.map(t => t.replace(/\s/g, '')).filter(t => t.length > 4)
])];
console.log('normalizedTerms:', normalizedTerms);

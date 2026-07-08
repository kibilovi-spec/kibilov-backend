require('dotenv').config();
const autodoc = require('../src/services/autodoc.js');

async function test() {
  const testSku = 'SB 462';
  console.log('Testing searchByArticleNo for:', testSku);
  try {
    const result = await autodoc.searchByArticleNo(testSku);
    console.log('SEARCH RESULT:', JSON.stringify(result, null, 2).slice(0, 2000));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}
test();

require('dotenv').config();
const autodoc = require('../src/services/autodoc.js');

async function test() {
  const articleId = 8974901;
  console.log('Testing getArticleCategory for articleId:', articleId);
  try {
    const result = await autodoc.getArticleCategory(articleId);
    console.log('CATEGORY RESULT:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}
test();

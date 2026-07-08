const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  
  const imgUrls = {};
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('scdn.autodoc.de') && (url.includes('.png') || url.includes('.webp'))) {
      const match = url.match(/\/(\d+)\.(png|webp)/);
      if (match) imgUrls[match[1]] = url;
    }
  });
  
  console.log('Loading...');
  await page.goto('https://www.autodoc.de/autoteile', {
    waitUntil: 'domcontentloaded', 
    timeout: 60000
  });
  await page.waitForTimeout(5000);
  
  console.log(`Found ${Object.keys(imgUrls).length} image URLs`);
  console.log(Object.entries(imgUrls).slice(0,5));
  
  fs.writeFileSync('/tmp/autodoc_imgmap.json', JSON.stringify(imgUrls, null, 2));
  await browser.close();
}
main().catch(console.error);

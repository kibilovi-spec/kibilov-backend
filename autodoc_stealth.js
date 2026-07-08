const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: {width:1920, height:1080}
  });
  
  const page = await context.newPage();
  
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
    window.chrome = {runtime: {}};
  });
  
  const imgUrls = {};
  page.on('response', res => {
    const url = res.url();
    if (res.status() === 200 && (url.includes('.png') || url.includes('.webp'))) {
      const match = url.match(/\/(\d{5,6})\.(png|webp)/);
      if (match) imgUrls[match[1]] = url;
    }
  });
  
  await page.goto('https://www.autodoc.de/autoteile', {waitUntil:'domcontentloaded', timeout:60000});
  await page.waitForTimeout(4000);
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(3000);
  
  const imgs = await page.evaluate(() => 
    [...document.querySelectorAll('img')].map(i => i.src).filter(s => s.includes('http'))
  );
  
  console.log(`Network: ${Object.keys(imgUrls).length}, DOM imgs: ${imgs.length}`);
  console.log('DOM sample:', imgs.slice(0,5));
  console.log('Network sample:', Object.entries(imgUrls).slice(0,5));
  
  fs.writeFileSync('/tmp/stealth_result.json', JSON.stringify({network:imgUrls, dom:imgs}));
  await browser.close();
}
main().catch(console.error);

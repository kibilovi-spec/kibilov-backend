const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  
  const imgUrls = {};
  page.on('response', res => {
    const url = res.url();
    if (url.includes('scdn.autodoc.de') || url.includes('cdn') || url.includes('.png') || url.includes('.webp')) {
      if (res.status() === 200) {
        const match = url.match(/\/(\d+)\.(png|webp|jpg)/);
        if (match && parseInt(match[1]) > 1000) imgUrls[match[1]] = url;
      }
    }
  });
  
  await page.goto('https://www.autodoc.de/autoteile', {waitUntil:'domcontentloaded', timeout:60000});
  await page.waitForTimeout(2000);
  
  // scroll down to trigger lazy load
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(3000);
  
  // ყველა img src ამოვიღოთ
  const imgs = await page.evaluate(() => 
    [...document.querySelectorAll('img')].map(i => ({src: i.src, alt: i.alt}))
  );
  
  console.log(`Network intercepted: ${Object.keys(imgUrls).length}`);
  console.log(`DOM imgs: ${imgs.length}`);
  console.log('Sample DOM:', imgs.slice(0,5));
  
  fs.writeFileSync('/tmp/autodoc_imgs.json', JSON.stringify({network: imgUrls, dom: imgs}, null, 2));
  await browser.close();
}
main().catch(console.error);

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('json') || request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
      console.log('XHR/FETCH:', url);
    }
  });

  try {
    await page.goto('https://www.theweather.com/satellites/', { waitUntil: 'networkidle2', timeout: 15000 });
  } catch (e) {
    console.error(e);
  }

  await browser.close();
})();

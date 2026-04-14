import { chromium } from 'playwright';

const SHORT_TIMEOUT = 5000;
const MEDIUM_TIMEOUT = 30000;

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  const networkRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleMessages.push(`[ERROR] ${msg.text()}`);
    }
  });

  page.on('request', req => {
    if (req.url().includes('api') || req.url().includes('analyze')) {
      networkRequests.push(`-> ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', res => {
    if (res.url().includes('api') || res.url().includes('analyze')) {
      networkRequests.push(`<- ${res.status()} ${res.url()}`);
    }
  });

  try {
    console.log('=== Opening http://localhost:3001 ===');
    await page.goto('http://localhost:3001', { timeout: MEDIUM_TIMEOUT, waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // === STEP 2: Find the GitHub URL input ===
    console.log('\n=== Looking for input ===');
    const textarea = page.locator('textarea').first();
    const isVisible = await textarea.isVisible();
    console.log(`Textarea visible: ${isVisible}`);

    if (isVisible) {
      // === STEP 3: Enter GitHub URL ===
      console.log('\n=== Entering GitHub URL ===');
      await textarea.fill('https://github.com/lukeed/socks');
      console.log('Filled: https://github.com/lukeed/socks');

      // === STEP 4: Find and click analyze ===
      console.log('\n=== Looking for analyze button ===');
      const analyzeBtn = page.locator('button:has-text("分析")').first();
      const btnVisible = await analyzeBtn.isVisible();
      console.log(`Analyze button visible: ${btnVisible}`);

      if (btnVisible) {
        console.log('\n=== Clicking analyze ===');
        await analyzeBtn.click();
        console.log('Clicked!');

        // Wait and watch for any API calls
        await page.waitForTimeout(2000);

        // Check what API requests were made
        console.log('\n=== Network requests during analysis ===');
        networkRequests.forEach(req => console.log(req));

        // Check page text for status
        console.log('\n=== Page text after click ===');
        const pageText = await page.locator('body').innerText();
        console.log(pageText.slice(0, 2000));

        // Look for any new content that appeared
        const newSvgs = await page.locator('svg').count();
        const newCanvases = await page.locator('canvas').count();
        console.log(`\nSVG count: ${newSvgs}`);
        console.log(`Canvas count: ${newCanvases}`);
      }
    } else {
      console.log('Could not find visible textarea');
      // Dump all text on page
      console.log('\n=== All visible text ===');
      console.log(await page.locator('body').innerText());
    }

    // Report console errors
    if (consoleMessages.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleMessages.forEach(msg => console.log(msg));
    } else {
      console.log('\nNo console errors detected');
    }

  } catch (error) {
    console.error('TEST ERROR:', error.message);
    if (consoleMessages.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleMessages.forEach(msg => console.log(msg));
    }
  } finally {
    await browser.close();
  }
}

runTest();

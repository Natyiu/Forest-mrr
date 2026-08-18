const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('='.repeat(60));
  console.log('THEME CHECK RESULTS');
  console.log('='.repeat(60));
  
  // Navigate to the page
  await page.goto('http://localhost:3001/dashboard/admin/settings', { waitUntil: 'networkidle0' });
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Step 2: Get data-app-theme
  const dataAppTheme = await page.evaluate(() => {
    return document.documentElement.getAttribute('data-app-theme');
  });
  console.log('\n📍 Step 2 - document.documentElement.getAttribute(\'data-app-theme\'):');
  console.log('   ', dataAppTheme || 'null');
  
  // Step 3: Get document.documentElement.className
  const className = await page.evaluate(() => {
    return document.documentElement.className;
  });
  console.log('\n📍 Step 3 - document.documentElement.className:');
  console.log('   ', className || 'empty');
  
  // Step 4: Get CSS variable --primary
  const primaryColor = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  });
  console.log('\n📍 Step 4 - getComputedStyle(document.documentElement).getPropertyValue(\'--primary\'):');
  console.log('   ', primaryColor || 'not set');
  
  console.log('\n' + '='.repeat(60));
  console.log('CLICKING BLUE THEME BUTTON...');
  console.log('='.repeat(60));
  
  // Step 5: Click Blue theme button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const blueButton = buttons.find(btn => btn.textContent && btn.textContent.trim() === 'Blue');
    if (blueButton) {
      blueButton.click();
    } else {
      throw new Error('Blue button not found');
    }
  });
  
  // Step 6: Wait 2 seconds
  await page.waitForTimeout(2000);
  
  // Step 7: Get data-app-theme again
  const dataAppTheme2 = await page.evaluate(() => {
    return document.documentElement.getAttribute('data-app-theme');
  });
  console.log('\n📍 Step 7 - document.documentElement.getAttribute(\'data-app-theme\') AFTER CLICK:');
  console.log('   ', dataAppTheme2 || 'null');
  
  // Step 8: Get --primary again
  const primaryColor2 = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  });
  console.log('\n📍 Step 8 - getComputedStyle(document.documentElement).getPropertyValue(\'--primary\') AFTER CLICK:');
  console.log('   ', primaryColor2 || 'not set');
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60) + '\n');
  
  await browser.close();
})();

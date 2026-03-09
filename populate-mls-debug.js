/**
 * Debug version - saves screenshot and HTML to help fix selectors
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const MLS_LOGIN_URL = 'https://www.utahrealestate.com/auth/login/';
const MLS_LISTINGS_URL = 'https://www.utahrealestate.com/lip/index/';
const MLS_EMAIL = process.env.MLS_EMAIL || 'Lloric';
const MLS_PASSWORD = process.env.MLS_PASSWORD || 'Yvette3.3';

async function launchBrowser() {
  return puppeteer.launch({
    headless: false, // Show browser so you can see it
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1400, height: 900 },
  });
}

async function login(page) {
  console.log('🔐 Logging into MLS portal...');
  await page.goto(MLS_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  
  await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });
  await page.type('input[name="username"], input[type="text"]', MLS_EMAIL);
  await page.type('input[name="password"], input[type="password"]', MLS_PASSWORD);
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
    page.click('button[type="submit"], input[type="submit"]'),
  ]);
  
  console.log('✅ Logged in successfully');
}

async function debugListingsPage(page) {
  console.log('📋 Navigating to listings page...');
  await page.goto(MLS_LISTINGS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('📸 Taking screenshot...');
  await page.screenshot({ path: 'mls-listings-debug.png', fullPage: true });
  
  console.log('📄 Saving HTML...');
  const html = await page.content();
  fs.writeFileSync('mls-listings-debug.html', html);
  
  console.log('🔍 Analyzing page structure...');
  
  // Try to find any tables or listing containers
  const structure = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const rows = document.querySelectorAll('tr');
    const divs = document.querySelectorAll('div[class*="listing"], div[class*="row"]');
    
    return {
      tableCount: tables.length,
      rowCount: rows.length,
      listingDivCount: divs.length,
      firstTableHTML: tables[0]?.outerHTML.substring(0, 500),
      sampleRowText: Array.from(rows).slice(0, 5).map(r => r.textContent.trim().substring(0, 200)),
    };
  });
  
  console.log('\n📊 Page Structure:');
  console.log('  Tables found:', structure.tableCount);
  console.log('  Rows found:', structure.rowCount);
  console.log('  Listing divs found:', structure.listingDivCount);
  console.log('\n📝 Sample row texts:');
  structure.sampleRowText.forEach((text, i) => {
    if (text) console.log(`  Row ${i + 1}: ${text}`);
  });
  
  console.log('\n✅ Debug files saved:');
  console.log('  - mls-listings-debug.png (screenshot)');
  console.log('  - mls-listings-debug.html (page HTML)');
  console.log('\n👀 Browser window left open for inspection. Close it when done.');
}

async function main() {
  let browser;
  
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await login(page);
    await debugListingsPage(page);
    
    // Don't close browser - let user inspect
    console.log('\n⏸️  Browser left open for inspection...');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    if (browser) await browser.close();
    process.exit(1);
  }
}

main();

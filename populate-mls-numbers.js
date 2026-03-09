/**
 * Script to populate MLS numbers from UtahRealEstate.com portal
 * Run this periodically to keep MLS numbers in sync
 * 
 * Usage: node populate-mls-numbers.js
 */

const puppeteer = require('puppeteer');
const Database = require('./db-wrapper');
const path = require('path');

const MLS_LOGIN_URL = 'https://www.utahrealestate.com/auth/login/';
const MLS_LISTINGS_URL = 'https://www.utahrealestate.com/lip/index/';
const MLS_EMAIL = process.env.MLS_EMAIL || 'Lloric';
const MLS_PASSWORD = process.env.MLS_PASSWORD || 'Yvette3.3';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'regal.db');
let db;

async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
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

async function scrapeListings(page) {
  console.log('📋 Navigating to listings page...');
  await page.goto(MLS_LISTINGS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  
  console.log('⏳ Waiting for listings to load...');
  // Wait for content to load - look for MLS numbers or addresses
  try {
    await page.waitForFunction(
      () => document.body.textContent.includes('2109020') || 
            document.body.textContent.includes('11378 N Regal Ridge'),
      { timeout: 30000 }
    );
    console.log('✅ Listings loaded!');
  } catch {
    console.log('⚠️  Timeout waiting for listings - continuing anyway...');
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('📊 Scraping listing data...');
  
  // Extract MLS numbers and addresses from the page
  const listings = await page.evaluate(() => {
    const results = [];
    
    // Get all text content and try different selectors
    const allElements = document.querySelectorAll('*');
    
    // Look for elements containing 7-digit MLS numbers
    const mlsElements = Array.from(allElements).filter(el => /\b\d{7}\b/.test(el.textContent));
    
    for (const mlsEl of mlsElements) {
      // Try to find MLS number
      const mlsMatch = mlsEl.textContent.match(/\b(\d{7})\b/);
      if (!mlsMatch) continue;
      
      const mlsNumber = mlsMatch[1];
      
      // Look for address near this MLS number (in same row/container)
      const container = mlsEl.closest('tr, div, section, article');
      if (!container) continue;
      
      const containerText = container.textContent;
      
      // Match addresses like "11378 N Regal Ridge Ct #7" or "1722 S 4300 St #103"
      const addressMatch = containerText.match(/(\d+\s+[NSEW]?\s*[A-Za-z0-9\s]+(?:St|Dr|Ct|Ln|Way|Rd|Ave|Blvd|Cir|Court|Street|Drive|Lane|Road|Avenue|Boulevard|Circle)(?:\s+#?\d+)?)/i);
      
      if (addressMatch) {
        const address = addressMatch[1].trim();
        
        // Avoid duplicates
        if (!results.some(r => r.mls_number === mlsNumber)) {
          results.push({
            mls_number: mlsNumber,
            address: address,
          });
        }
      }
    }
    
    return results;
  });
  
  console.log(`✅ Found ${listings.length} listings with MLS numbers`);
  return listings;
}

function normalizeAddress(addr) {
  return addr
    .toLowerCase()
    .replace(/\s*#\d+.*$/, '') // Remove apartment numbers
    .replace(/\s+/g, ' ')
    .trim();
}

async function updateDatabase(listings) {
  console.log('💾 Updating database...');
  
  let matched = 0;
  let updated = 0;
  
  for (const listing of listings) {
    const normalizedMLS = normalizeAddress(listing.address);
    
    // Try to find matching available home by address
    const homes = db.prepare('SELECT id, address, mls_number FROM available_homes').all();
    
    for (const home of homes) {
      const normalizedHome = normalizeAddress(home.address || '');
      
      if (normalizedMLS === normalizedHome) {
        matched++;
        
        if (home.mls_number !== listing.mls_number) {
          db.prepare('UPDATE available_homes SET mls_number = ? WHERE id = ?')
            .run(listing.mls_number, home.id);
          updated++;
          console.log(`  ✓ Updated ${home.address}: MLS #${listing.mls_number}`);
        }
      }
    }
  }
  
  // Save changes to disk
  db.save();
  db.close();
  console.log(`\n✅ Done! Matched ${matched} listings, updated ${updated} MLS numbers`);
}

async function main() {
  let browser;
  
  try {
    // Initialize database
    await Database.init();
    db = new Database(dbPath);
    
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await login(page);
    const listings = await scrapeListings(page);
    await browser.close();
    
    await updateDatabase(listings);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    if (browser) await browser.close();
    process.exit(1);
  }
}

main();

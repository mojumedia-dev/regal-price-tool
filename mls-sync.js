/**
 * MLS Sync Module (WFRMLS/PCMLS via UtahRealEstate.com)
 * Uses Puppeteer to update listing prices on www.utahrealestate.com
 */

const puppeteer = require('puppeteer');

const MLS_LOGIN_URL = 'https://www.utahrealestate.com/auth/login/';
const MLS_EMAIL = process.env.MLS_EMAIL || 'Lloric';
const MLS_PASSWORD = process.env.MLS_PASSWORD || 'Yvette3.3';

/**
 * Launch a Puppeteer browser with stealth settings
 */
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1400, height: 900 },
  });
}

/**
 * Login to MLS portal
 */
async function login(page) {
  console.log('🔐 Logging into MLS portal...');
  await page.goto(MLS_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Wait for login form
  await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });
  
  // Enter credentials
  await page.type('input[name="username"], input[type="text"]', MLS_EMAIL);
  await page.type('input[name="password"], input[type="password"]', MLS_PASSWORD);
  
  // Click login button
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
    page.click('button[type="submit"], input[type="submit"]'),
  ]);
  
  console.log('✅ Logged in successfully');
}

/**
 * Navigate to listings page and find specific listing by MLS number
 */
async function navigateToListing(page, mlsNumber) {
  console.log(`🔍 Navigating to listings page...`);
  
  // Go to listings index page
  await page.goto('https://www.utahrealestate.com/lip/index/', { 
    waitUntil: 'networkidle2', 
    timeout: 60000 
  });
  
  await page.waitForTimeout(2000);
  
  console.log(`🔍 Finding listing ${mlsNumber}...`);
  
  // Try to find the listing in the table by MLS number
  // The listing might be in a row with the MLS number visible
  const rowSelectors = [
    `tr:has-text("${mlsNumber}")`,
    `tr:contains("${mlsNumber}")`,
    `[data-mls="${mlsNumber}"]`,
  ];
  
  // Try to find and click the Edit button for this MLS number
  const found = await page.evaluate((mls) => {
    // Find all rows in the table
    const rows = document.querySelectorAll('tr, .listing-row');
    for (const row of rows) {
      // Check if this row contains the MLS number
      if (row.textContent.includes(mls)) {
        // Find the edit button in this row
        const editBtn = row.querySelector('a[href*="edit"], button:contains("Edit"), .edit-button, a:contains("Edit")');
        if (editBtn) {
          editBtn.click();
          return true;
        }
      }
    }
    return false;
  }, mlsNumber);
  
  if (found) {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Navigated to listing edit page');
    return true;
  }
  
  throw new Error(`Could not find listing ${mlsNumber} on listings page`);
}

/**
 * Update the listing price
 */
async function updatePrice(page, newPrice) {
  console.log(`💰 Updating price to $${newPrice.toLocaleString()}...`);
  
  // Wait for price input field
  const priceSelectors = [
    'input[name="price"]',
    'input[name="listPrice"]',
    'input[name="list_price"]',
    'input[placeholder*="price" i]',
  ];
  
  let priceInput = null;
  for (const selector of priceSelectors) {
    try {
      priceInput = await page.waitForSelector(selector, { timeout: 3000 });
      break;
    } catch {
      continue;
    }
  }
  
  if (!priceInput) {
    throw new Error('Could not find price input field');
  }
  
  // Clear existing value and enter new price
  await priceInput.click({ clickCount: 3 }); // Select all
  await priceInput.press('Backspace');
  await priceInput.type(String(newPrice));
  
  // Save changes
  const saveSelectors = [
    'button[type="submit"]',
    'button:has-text("Save")',
    'button:has-text("Update")',
    'input[type="submit"]',
  ];
  
  for (const selector of saveSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        page.click(selector),
      ]);
      console.log('✅ Price updated successfully');
      return true;
    } catch {
      continue;
    }
  }
  
  throw new Error('Could not find save button');
}

/**
 * Main function: Update an MLS listing price
 * @param {string} mlsNumber - MLS listing number
 * @param {number} newPrice - New listing price
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function updateListingPrice(mlsNumber, newPrice) {
  let browser;
  
  try {
    if (!mlsNumber) {
      throw new Error('MLS number is required');
    }
    
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // Set realistic headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    
    await login(page);
    await navigateToListing(page, mlsNumber);
    await updatePrice(page, newPrice);
    
    await browser.close();
    return { success: true, message: `Updated MLS listing ${mlsNumber} to $${newPrice.toLocaleString()}` };
    
  } catch (error) {
    console.error('❌ MLS sync error:', error.message);
    if (browser) await browser.close();
    return { success: false, message: error.message };
  }
}

module.exports = {
  updateListingPrice,
};

const puppeteer = require('puppeteer');
const path = require('path');

const SCREENSHOT_DIR = '/Users/strongestavenger/.openclaw/workspace/adam-files/homefiniti-screenshots';

async function explore() {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1400, height: 900 }
  });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  
  try {
    // Login
    await page.goto('https://app.homefiniti.com/accounts/login?next=/dashboard/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.type('#email_id', 'regalhomes.adam@gmail.com');
    await page.type('#password_id', 'MojuAI@2026');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('input[type="submit"]'),
    ]).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    console.log('Logged in');
    
    // Go to All Plans - try to show all by URL param
    await page.goto('https://app.homefiniti.com/core/dashboard/plan/list/?limit=100', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    
    // Check pagination links
    const paginationLinks = await page.$$eval('a', els => 
      els.filter(e => /view|page|all|100|50/i.test(e.textContent))
        .map(e => ({ href: e.href, text: e.textContent.trim().substring(0, 60) }))
    );
    console.log('Pagination links:', JSON.stringify(paginationLinks));
    
    // Click "View All" link if found
    const viewAllLink = paginationLinks.find(l => /view all/i.test(l.text));
    if (viewAllLink) {
      console.log('Clicking View All:', viewAllLink.href);
      await page.goto(viewAllLink.href, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // Now get all plans
    const allPlans = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 3) return null;
        const editLink = row.querySelector('a[href*="form?id="]');
        return {
          name: cells[0]?.textContent?.trim(),
          location: cells[1]?.textContent?.trim(),
          price: cells[2]?.textContent?.trim(),
          editHref: editLink?.href
        };
      }).filter(Boolean);
    });
    console.log(`Total plans found: ${allPlans.length}`);
    
    // Find Parkside plans
    const parksidePlans = allPlans.filter(p => /parkside|sunrise/i.test(p.location));
    console.log('\nParkside plans:', JSON.stringify(parksidePlans, null, 2));
    
    // Find Balboa
    const balboa = allPlans.find(p => /balboa/i.test(p.name));
    console.log('\nBalboa:', JSON.stringify(balboa));
    
    if (!balboa) {
      console.log('\nAll plan names:', allPlans.map(p => `${p.name} (${p.location})`).join('\n'));
    }
    
    // If we found a parkside plan, let's edit Cambridge to see the form structure
    const cambridge = parksidePlans.find(p => /cambridge/i.test(p.name)) || parksidePlans[0];
    const planToEdit = balboa || cambridge;
    
    if (planToEdit?.editHref) {
      console.log(`\n--- Editing ${planToEdit.name} ---`);
      await page.goto(planToEdit.editHref, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-plan-edit.png'), fullPage: true });
      
      // Get ALL form fields
      const fields = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
        return els.map(el => {
          // Find associated label
          let label = '';
          if (el.id) {
            const labelEl = document.querySelector(`label[for="${el.id}"]`);
            label = labelEl?.textContent?.trim() || '';
          }
          if (!label) {
            const parent = el.closest('.form-group, .control-group, tr, .row, .field');
            label = parent?.querySelector('label')?.textContent?.trim() || '';
          }
          return {
            tag: el.tagName, type: el.type, name: el.name, id: el.id,
            value: el.value?.substring(0, 100), label: label?.substring(0, 60),
          };
        });
      });
      console.log('\nForm fields:', JSON.stringify(fields, null, 2));
      
      // Find submit/save button
      const buttons = await page.$$eval('button, input[type="submit"]', els => 
        els.map(e => ({ tag: e.tagName, text: e.textContent?.trim()?.substring(0, 50), type: e.type, name: e.name }))
      );
      console.log('\nButtons:', JSON.stringify(buttons));
      
      // Scroll down for more fields and screenshot
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07b-plan-edit-scroll.png'), fullPage: true });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true }).catch(() => {});
  }
  
  await browser.close();
  console.log('Done');
}

explore().catch(console.error);

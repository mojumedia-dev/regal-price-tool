const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const logoBase64 = fs.readFileSync(path.join(__dirname, 'public', 'logo.png')).toString('base64');
const logoDataUrl = `data:image/png;base64,${logoBase64}`;

// EHO logo as inline SVG (white on transparent for dark footer)
const ehoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="28" height="34">
  <polygon points="50,5 95,45 80,45 80,95 20,95 20,45 5,45" fill="none" stroke="white" stroke-width="3"/>
  <rect x="40" y="60" width="20" height="35" fill="none" stroke="white" stroke-width="2.5"/>
  <text x="50" y="108" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="6" font-weight="bold">EQUAL HOUSING</text>
  <text x="50" y="116" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="6" font-weight="bold">OPPORTUNITY</text>
</svg>`;
const ehoDataUrl = `data:image/svg+xml;base64,${Buffer.from(ehoSvg).toString('base64')}`;

function formatPrice(cents) {
  return '$' + Number(cents).toLocaleString('en-US');
}

function formatNumber(n) {
  return Number(n).toLocaleString('en-US');
}

const commonStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;600&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @page { size: letter; margin: 0; }
  
  body {
    font-family: 'Source Sans 3', 'Helvetica Neue', Arial, sans-serif;
    color: #2D2D2D;
    width: 8.5in;
    min-height: 11in;
    position: relative;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 8.5in;
    min-height: 11in;
    position: relative;
    padding: 0.5in 0.5in 1.2in 0.5in;
    page-break-after: always;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid #6B1D2A;
  }

  .logo { width: 72px; height: auto; object-fit: contain; }

  .header-text h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 32px;
    font-weight: 400;
    font-style: italic;
    color: #6B1D2A;
    line-height: 1.1;
  }

  .header-text .subtitle {
    font-family: 'Source Sans 3', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #6B1D2A;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-top: 2px;
  }

  .header-text .date-subtitle {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 16px;
    font-style: italic;
    color: #6B1D2A;
    float: right;
    margin-left: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 11px;
  }

  thead th {
    background-color: #6B1D2A;
    color: white;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 1px;
    padding: 10px 8px;
    text-align: center;
    border: none;
  }

  thead th:first-child { text-align: left; padding-left: 16px; }

  tbody tr:nth-child(even) { background-color: #F5F5F5; }
  tbody tr:nth-child(odd) { background-color: #FFFFFF; }

  tbody td {
    padding: 10px 8px;
    text-align: center;
    border: none;
    font-size: 11px;
    color: #333;
  }

  tbody td:first-child { text-align: left; padding-left: 16px; }
  tbody td:last-child { font-weight: 600; }

  .footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: #6B1D2A;
    color: white;
    text-align: center;
    padding: 12px 0.5in 8px;
  }

  .footer-top {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 3px;
    margin-bottom: 8px;
  }

  .footer-divider {
    width: 2px;
    height: 16px;
    background: white;
    display: inline-block;
  }

  .footer-bottom {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 0 0.3in;
  }

  .footer-eho {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }

  .footer-disclaimer {
    font-size: 7px;
    line-height: 1.4;
    text-align: center;
    opacity: 0.9;
  }

  .eho-icon {
    display: inline-block;
    width: 28px;
    height: 28px;
    border: 1.5px solid white;
    font-size: 5px;
    text-align: center;
    line-height: 1.2;
    padding: 2px;
  }
`;

function footerHTML(community) {
  const today = new Date();
  const dateStr = `${(today.getMonth()+1).toString().padStart(2,'0')}.${today.getDate().toString().padStart(2,'0')}.${today.getFullYear().toString().slice(2)}`;
  return `
    <div class="footer">
      <div class="footer-top">
        <span>${community.website || 'REGALUT.COM'}</span>
        <span class="footer-divider"></span>
        <span>${community.phone || '385-446-5524'}</span>
      </div>
      <div class="footer-bottom">
        <img src="${ehoDataUrl}" style="width:28px;height:28px;object-fit:contain;">
        <div class="footer-disclaimer">
          Pricing ans specifications subject to change without notice. Floor plan image renderings & exterior elevation renderings are for illustrative purposes only and
          may include upgraded options available for purchase at a higher cost that are not included in the base price of the home, whether visually represented as
          optional or not. Please contact us to review plans, pricing, options, incentives and availability. Marketed by Regal Homes Realty. ${dateStr}
        </div>
      </div>
    </div>
  `;
}

function homesitesHTML(community, data) {
  const rows = data.map(d => `
    <tr>
      <td style="text-align:center; padding-left:8px;">${d.lot_number}</td>
      <td style="text-align:center;">${d.address}</td>
      <td style="text-align:center;">${d.front_facing_direction}</td>
      <td style="text-align:center;">${formatNumber(d.sqft)}</td>
      <td style="text-align:center; font-weight:600;">${formatPrice(d.premium_price)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
    <div class="page">
      <div class="header">
        <img src="${logoDataUrl}" class="logo">
        <div class="header-text">
          <h1>Homesites</h1>
          <div class="subtitle">${community.name}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="text-align:center; padding-left:8px;">Homesite</th>
            <th style="text-align:center;">Address</th>
            <th style="text-align:center;">Front Facing<br>Direction</th>
            <th style="text-align:center;">SQ.FT</th>
            <th style="text-align:center;">Homesite Premium</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${footerHTML(community)}
    </div>
  </body></html>`;
}

function basePricesHTML(community, data) {
  const compact = data.length > 10;
  const rowPad = compact ? '4px 6px' : '8px';
  const rows = data.map(d => `
    <tr>
      <td style="padding:${rowPad};">${d.name}</td>
      <td style="text-align:center;padding:${rowPad};">${formatNumber(d.total_sqft)}</td>
      <td style="text-align:center;padding:${rowPad};">${d.finished_sqft_range}</td>
      <td style="text-align:center;padding:${rowPad};">${d.floors}</td>
      <td style="text-align:center;padding:${rowPad};">${d.beds_range}</td>
      <td style="text-align:center;padding:${rowPad};">${d.baths_range}</td>
      <td style="text-align:center;padding:${rowPad};">${d.garage_range}</td>
      <td style="text-align:center;padding:${rowPad};font-weight:600;">${formatPrice(d.base_price)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><style>${commonStyles}
    ${compact ? `
      table { font-size: 9px; } 
      thead th { font-size: 7.5px; padding: 5px 4px; }
      .header { margin-bottom: 12px; padding-bottom: 8px; }
      .header-text h1 { font-size: 26px; }
      .page { padding: 0.35in 0.5in 1.0in 0.5in; }
    ` : ''}
    .community-info { margin-top: ${compact ? '8px' : '40px'}; page-break-inside: avoid; }
    .community-info h2 { font-family: 'Playfair Display', Georgia, serif; font-size: ${compact ? '18px' : '28px'}; font-style: italic; color: #2D2D2D; margin-bottom: ${compact ? '6px' : '20px'}; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: ${compact ? '12px' : '24px'}; font-size: ${compact ? '9px' : '11px'}; }
    .info-section h3 { font-size: ${compact ? '9px' : '11px'}; font-weight: 700; text-transform: uppercase; color: #6B1D2A; margin-bottom: ${compact ? '4px' : '8px'}; letter-spacing: 1px; }
    .info-section p, .info-section li { font-size: ${compact ? '8.5px' : '10px'}; line-height: 1.4; color: #444; }
    .info-section ul { list-style: disc; padding-left: 16px; }
    .sales-office { margin-top: ${compact ? '8px' : '20px'}; }
    .sales-office h3 { font-size: ${compact ? '8.5px' : '10px'}; font-weight: 700; font-style: italic; color: #6B1D2A; text-transform: uppercase; letter-spacing: 1px; }
    .sales-office p { font-size: 10px; color: #444; }
    .sales-manager { margin-top: ${compact ? '6px' : '16px'}; }
    .sales-manager h3 { font-family: 'Playfair Display', Georgia, serif; font-size: ${compact ? '11px' : '14px'}; font-style: italic; color: #2D2D2D; }
    .sales-manager p { font-size: ${compact ? '8.5px' : '10px'}; color: #666; }
    .sales-manager .phone { font-size: ${compact ? '12px' : '16px'}; font-weight: 300; color: #2D2D2D; }
    .utility-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: ${compact ? '1px 0' : '2px 0'}; }
  </style></head><body>
    <div class="page">
      <div class="header">
        <img src="${logoDataUrl}" class="logo">
        <div class="header-text">
          <h1>Base Price</h1>
          <div class="subtitle">${community.name}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Plan Name</th>
            <th style="text-align:center;">Total<br>SQFT</th>
            <th style="text-align:center;">Finished<br>SQFT</th>
            <th style="text-align:center;">Floors</th>
            <th style="text-align:center;">Beds</th>
            <th style="text-align:center;">Baths</th>
            <th style="text-align:center;">Garage</th>
            <th style="text-align:center;">Starting At</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="community-info">
        <h2>Community Information</h2>
        <div class="info-grid">
          <div>
            <div class="info-section">
              <h3>Neighborhood Highlights</h3>
              <ul>
                <li>Adjacent to Maple Grove Park which include a silo pavilion, children's playground with zipline, pickleball courts, and open grass area</li>
                <li>Parkside has no HOA but does include CC&Rs with a $15 annual fee</li>
              </ul>
            </div>
            <div class="sales-office">
              <h3>Sales Office</h3>
              <p>${community.sales_office_address || ''}<br>
              ${community.sales_office_city || ''}<br>
              Office Hours: ${community.sales_office_hours || ''}</p>
            </div>
            <div class="sales-manager">
              <h3 style="font-style:italic;">${community.sales_manager_name || ''}</h3>
              <p>Community Sales Manager</p>
              <p>${community.sales_office_address || ''}${community.sales_office_city ? ', ' + community.sales_office_city : ''}</p>
              <p class="phone">${community.sales_manager_phone || ''}</p>
            </div>
          </div>
          <div>
            <div class="info-section">
              <h3>Utility Information</h3>
              <div class="utility-row"><span>Electricity:</span><span>Rocky Mountain Power ......... 800-221-7070</span></div>
              <div class="utility-row"><span>Garbage/Recycling:</span><span>Mapleton City .................... 801-489-5655</span></div>
              <div class="utility-row"><span>Natural Gas:</span><span>Enbridge Gas ...................... 800-323-5517</span></div>
              <div class="utility-row"><span>Water/Sewer:</span><span>Mapleton City .................... 801-489-5655</span></div>
              <div class="utility-row"><span>Internet:</span><span>Xfinity ................................ 800-934-6489</span></div>
            </div>
          </div>
        </div>
      </div>
      ${footerHTML(community)}
    </div>
  </body></html>`;
}

function availableHomesHTML(community, data) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const monthYear = `${months[now.getMonth()]} ${now.getFullYear()}`;

  const rows = data.map(d => `
    <tr>
      <td>${d.plan_name}</td>
      <td style="text-align:center;">${d.address}</td>
      <td style="text-align:center;">${formatNumber(d.total_sqft)}</td>
      <td style="text-align:center;">${formatNumber(d.finished_sqft)}</td>
      <td style="text-align:center;">${d.beds}</td>
      <td style="text-align:center;">${d.baths}</td>
      <td style="text-align:center;">${d.garage}</td>
      <td style="text-align:center;">${d.est_move_in}</td>
      <td style="text-align:center; font-weight:600;">${formatPrice(d.price)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><style>${commonStyles}
    .header-row { display: flex; justify-content: space-between; align-items: flex-end; }
    .community-info { margin-top: 40px; }
    .community-info h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-style: italic; color: #2D2D2D; margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 10px; }
    .info-section h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6B1D2A; margin-bottom: 6px; letter-spacing: 1px; }
    .info-section p, .info-section li { font-size: 9.5px; line-height: 1.6; color: #444; }
    .info-section ul { list-style: disc; padding-left: 16px; }
    .warranty-section { margin-top: 12px; }
    .sales-manager { margin-top: 12px; }
    .sales-manager h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 14px; font-style: italic; color: #2D2D2D; }
    .sales-manager p { font-size: 10px; color: #666; }
    .sales-manager .phone { font-size: 16px; font-weight: 300; color: #2D2D2D; }
    .sales-manager .email { font-size: 10px; color: #444; }
    .utility-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: 2px 0; font-size: 9.5px; }
    .tax-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 9.5px; }
    .school-section p { font-size: 9.5px; color: #444; }
  </style></head><body>
    <div class="page">
      <div class="header">
        <img src="${logoDataUrl}" class="logo">
        <div class="header-text" style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <h1>Available Designer Homes</h1>
            <span style="font-family:'Playfair Display',serif; font-style:italic; font-size:16px; color:#6B1D2A;">${monthYear}</span>
          </div>
          <div class="subtitle">${community.name}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th style="text-align:center;">Address</th>
            <th style="text-align:center;">Total<br>SQFT</th>
            <th style="text-align:center;">Finished<br>SQFT</th>
            <th style="text-align:center;">Beds</th>
            <th style="text-align:center;">Baths</th>
            <th style="text-align:center;">Gar</th>
            <th style="text-align:center;">Est. Move In</th>
            <th style="text-align:center;">Price</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="community-info">
        <h2>Community Information</h2>
        <div class="info-grid">
          <div>
            <div class="info-section">
              <h3>Amenities</h3>
              <ul>
                <li>Community borders Maple Grove Park</li>
                <li>Bella Vita Community Pool Membership Available</li>
              </ul>
            </div>
            <div class="warranty-section info-section">
              <h3>Warranty Information</h3>
              <p>All residences are backed by a A 2-10 Builder's Warranty including:</p>
              <ul>
                <li>1 year workmanship warranty</li>
                <li>10 year structural warranty</li>
              </ul>
              <p>The warranty is fully transferable for a period of 10 years</p>
            </div>
            <div class="sales-manager">
              <h3>Community Sales Manager</h3>
              <h3 style="font-style:italic; margin-top:4px;">${community.sales_manager_name || ''}</h3>
              <p class="phone">${community.sales_manager_phone || ''}</p>
              <p class="email">${community.sales_manager_email || ''}</p>
            </div>
          </div>
          <div>
            <div class="info-section">
              <h3>Utility Information</h3>
              <div class="utility-row"><span>Electricity:</span><span>Rocky Mountain Power......800-221-7070</span></div>
              <div class="utility-row"><span>Garbage/Recycling:</span><span>Mapleton City...................801-489-5655</span></div>
              <div class="utility-row"><span>Natural Gas:</span><span>Enbridge Gas.....................800-323-5517</span></div>
              <div class="utility-row"><span>Sewer/Water:</span><span>Mapleton City...................801-489-5655</span></div>
              <div class="utility-row"><span>Internet:</span><span>Xfinity...............................800-934-6489</span></div>
            </div>
            <div class="info-section" style="margin-top:12px;">
              <h3>Property Tax Rates</h3>
              <div class="tax-row"><span>Sample County:</span><span>$.6195 per $100 of assessed value</span></div>
              <div class="tax-row"><span>Town of Mapleton City:</span><span>$.47 per $100 of assessed value</span></div>
              <div class="tax-row"><span>Combined Town/County:</span><span>$1.08 per $100 of assessed value</span></div>
            </div>
            <div class="info-section school-section" style="margin-top:12px;">
              <h3>Nebo School District</h3>
              <p>Maple Ridge Elementary School</p>
              <p>Mapleton Jr. High School</p>
              <p>Maple Mountain High School</p>
            </div>
          </div>
        </div>
      </div>
      ${footerHTML(community)}
    </div>
  </body></html>`;
}

async function generatePDF(type, community, data, outputPath) {
  let html;
  if (type === 'homesites') html = homesitesHTML(community, data);
  else if (type === 'base-prices') html = basePricesHTML(community, data);
  else if (type === 'available-homes') html = availableHomesHTML(community, data);
  else throw new Error('Invalid PDF type: ' + type);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  return outputPath;
}

module.exports = { generatePDF };

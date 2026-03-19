const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const logoBase64 = fs.readFileSync(path.join(__dirname, 'public', 'logo.png')).toString('base64');
const logoDataUrl = `data:image/png;base64,${logoBase64}`;

// EHO logo - use PNG file
const ehoBase64 = fs.readFileSync(path.join(__dirname, 'public', 'equal-housing-logo.png')).toString('base64');
const ehoDataUrl = `data:image/png;base64,${ehoBase64}`;

function formatPrice(cents) {
  return '$' + Number(cents).toLocaleString('en-US');
}

function formatNumber(n) {
  return Number(n).toLocaleString('en-US');
}

// Community-specific information
const communityInfo = {
  'parkside': {
    highlights: [
      'Adjacent to Maple Grove Park which include a silo pavilion, children\'s playground with zipline, pickleball courts, and open grass area',
      'Parkside has no HOA but does include CC&Rs with a $15 annual fee'
    ],
    utilities: {
      electricity: { name: 'Rocky Mountain Power', phone: '800-221-7070' },
      garbage: { name: 'Mapleton City', phone: '801-489-5655' },
      gas: { name: 'Enbridge Gas', phone: '800-323-5517' },
      water: { name: 'Mapleton City', phone: '801-489-5655' },
      internet: { name: 'Xfinity', phone: '800-934-6489' }
    },
    propertyTax: {
      county: { name: 'Sample County', rate: '$.6195 per $100 of assessed value' },
      city: { name: 'Town of Mapleton City', rate: '$.47 per $100 of assessed value' },
      combined: '$1.08 per $100 of assessed value'
    },
    schools: {
      district: 'Nebo School District',
      elementary: 'Maple Ridge Elementary School',
      juniorHigh: 'Mapleton Jr. High School',
      highSchool: 'Maple Mountain High School'
    },
    amenities: [
      'Community borders Maple Grove Park',
      'Bella Vita Community Pool Membership Available'
    ]
  },
  'bella-vita': {
    highlights: [
      'Resort-style community pool and clubhouse',
      'Walking trails and green spaces throughout',
      'Close to shopping, dining, and entertainment'
    ],
    utilities: {
      electricity: { name: 'Rocky Mountain Power', phone: '800-221-7070' },
      garbage: { name: 'Mapleton City', phone: '801-489-5655' },
      gas: { name: 'Enbridge Gas', phone: '800-323-5517' },
      water: { name: 'Mapleton City', phone: '801-489-5655' },
      internet: { name: 'Xfinity', phone: '800-934-6489' }
    },
    propertyTax: {
      county: { name: 'Utah County', rate: '$.6195 per $100 of assessed value' },
      city: { name: 'Mapleton City', rate: '$.47 per $100 of assessed value' },
      combined: '$1.08 per $100 of assessed value'
    },
    schools: {
      district: 'Nebo School District',
      elementary: 'Maple Ridge Elementary School',
      juniorHigh: 'Mapleton Jr. High School',
      highSchool: 'Maple Mountain High School'
    },
    amenities: [
      'Community pool and clubhouse',
      'Walking and biking trails',
      'Parks and green spaces'
    ]
  },
  'bristol-farms': {
    highlights: [
      'Peaceful country living near Ogden',
      'Large homesites with mountain views',
      'Close to outdoor recreation'
    ],
    utilities: {
      electricity: { name: 'Rocky Mountain Power', phone: '800-221-7070' },
      garbage: { name: 'West Haven City', phone: '801-737-8414' },
      gas: { name: 'Dominion Energy', phone: '800-323-5517' },
      water: { name: 'West Haven City', phone: '801-737-8414' },
      internet: { name: 'Xfinity', phone: '800-934-6489' }
    },
    propertyTax: {
      county: { name: 'Weber County', rate: '$.68 per $100 of assessed value' },
      city: { name: 'West Haven City', rate: '$.52 per $100 of assessed value' },
      combined: '$1.20 per $100 of assessed value'
    },
    schools: {
      district: 'Weber School District',
      elementary: 'West Haven Elementary',
      juniorHigh: 'Rocky Mountain Jr. High',
      highSchool: 'Fremont High School'
    },
    amenities: [
      'Large homesites',
      'Mountain and valley views',
      'Close to Pineview Reservoir'
    ]
  },
  'amanti-lago': {
    highlights: [
      'Luxury lakeside living in Heber Valley',
      'Private community with exclusive amenities',
      'Stunning mountain and water views'
    ],
    utilities: {
      electricity: { name: 'Rocky Mountain Power', phone: '800-221-7070' },
      garbage: { name: 'Heber City', phone: '435-654-3211' },
      gas: { name: 'Dominion Energy', phone: '800-323-5517' },
      water: { name: 'Heber City', phone: '435-654-3211' },
      internet: { name: 'CentraCom', phone: '435-654-0220' }
    },
    propertyTax: {
      county: { name: 'Wasatch County', rate: '$.58 per $100 of assessed value' },
      city: { name: 'Heber City', rate: '$.45 per $100 of assessed value' },
      combined: '$1.03 per $100 of assessed value'
    },
    schools: {
      district: 'Wasatch School District',
      elementary: 'Heber Valley Elementary',
      juniorHigh: 'Rocky Mountain Middle School',
      highSchool: 'Wasatch High School'
    },
    amenities: [
      'Private lake access',
      'Community clubhouse',
      'Walking trails around the lake'
    ]
  },
  'windflower': {
    highlights: [
      'Charming community in Heber Valley',
      'Family-friendly neighborhood',
      'Close to schools and parks'
    ],
    utilities: {
      electricity: { name: 'Rocky Mountain Power', phone: '800-221-7070' },
      garbage: { name: 'Heber City', phone: '435-654-3211' },
      gas: { name: 'Dominion Energy', phone: '800-323-5517' },
      water: { name: 'Heber City', phone: '435-654-3211' },
      internet: { name: 'CentraCom', phone: '435-654-0220' }
    },
    propertyTax: {
      county: { name: 'Wasatch County', rate: '$.58 per $100 of assessed value' },
      city: { name: 'Heber City', rate: '$.45 per $100 of assessed value' },
      combined: '$1.03 per $100 of assessed value'
    },
    schools: {
      district: 'Wasatch School District',
      elementary: 'Heber Valley Elementary',
      juniorHigh: 'Rocky Mountain Middle School',
      highSchool: 'Wasatch High School'
    },
    amenities: [
      'Parks and playgrounds',
      'Walking and biking trails',
      'Close to downtown Heber'
    ]
  }
};

function getCommunityInfo(slug) {
  return communityInfo[slug] || communityInfo['parkside']; // Fallback to parkside if not found
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
    height: 11in;
    position: relative;
    padding: 0.4in 0.5in 1.0in 0.5in;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 2px solid #6B1D2A;
  }

  .logo { 
    max-width: 80px; 
    max-height: 80px; 
    width: auto; 
    height: auto; 
    object-fit: contain; 
  }

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
    margin-top: 6px;
    font-size: 10px;
  }

  thead th {
    background-color: #6B1D2A;
    color: white;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 8px;
    letter-spacing: 0.5px;
    padding: 6px 6px;
    text-align: center;
    border: none;
  }

  thead th:first-child { text-align: left; padding-left: 12px; }

  tbody tr:nth-child(even) { background-color: #F5F5F5; }
  tbody tr:nth-child(odd) { background-color: #FFFFFF; }

  tbody td {
    padding: 6px 6px;
    text-align: center;
    border: none;
    font-size: 9px;
    color: #333;
  }

  tbody td:first-child { text-align: left; padding-left: 12px; }
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
    align-items: center;
    gap: 8px;
    padding: 0 0.3in;
  }

  .footer-eho {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .footer-disclaimer {
    font-size: 7px;
    line-height: 1.4;
    text-align: left;
    opacity: 0.9;
    flex: 1;
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
        <div class="footer-eho">
          <img src="${ehoDataUrl}" style="width:28px;height:28px;object-fit:contain;">
        </div>
        <div class="footer-disclaimer">
          Pricing and specifications subject to change without notice. Floor plan image renderings & exterior elevation renderings are for illustrative purposes only and
          may include upgraded options available for purchase at a higher cost that are not included in the base price of the home, whether visually represented as
          optional or not. Please contact us to review plans, pricing, options, incentives and availability. Marketed by Regal Homes Realty. ${dateStr}
        </div>
      </div>
    </div>
  `;
}

function homesitesHTML(community, data) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const monthYear = `${months[now.getMonth()]} ${now.getFullYear()}`;
  const info = getCommunityInfo(community.slug);

  // Dynamic scaling based on row count
  const rowCount = data.length;
  const scale = rowCount <= 8 ? 'normal' : rowCount <= 12 ? 'compact' : 'dense';
  
  const scaling = {
    normal: { tablePad: '6px', tableFont: '9px', headerFont: '8px', communityTop: '16px', communityH2: '18px', infoFont: '7.5px', infoH3: '8px' },
    compact: { tablePad: '5px', tableFont: '8.5px', headerFont: '7.5px', communityTop: '12px', communityH2: '16px', infoFont: '7px', infoH3: '7.5px' },
    dense: { tablePad: '4px', tableFont: '8px', headerFont: '7px', communityTop: '10px', communityH2: '14px', infoFont: '6.5px', infoH3: '7px' }
  }[scale];

  const rows = data.map(d => `
    <tr>
      <td style="text-align:center; padding-left:8px;">${d.lot_number}</td>
      <td style="text-align:center;">${d.address}</td>
      <td style="text-align:center;">${d.front_facing_direction}</td>
      <td style="text-align:center;">${formatNumber(d.sqft)}</td>
      <td style="text-align:center; font-weight:600;">${formatPrice(d.premium_price)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><style>${commonStyles}
    /* Dynamic scaling */
    tbody td { padding: ${scaling.tablePad}; font-size: ${scaling.tableFont}; }
    thead th { font-size: ${scaling.headerFont}; padding: ${scaling.tablePad}; }
    
    .community-info { margin-top: ${scaling.communityTop}; page-break-inside: avoid; }
    .community-info h2 { font-family: 'Playfair Display', Georgia, serif; font-size: ${scaling.communityH2}; font-style: italic; color: #2D2D2D; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: ${scaling.infoFont}; }
    .info-section h3 { font-size: ${scaling.infoH3}; font-weight: 700; text-transform: uppercase; color: #6B1D2A; margin-bottom: 4px; letter-spacing: 0.5px; }
    .info-section p, .info-section li { font-size: ${scaling.infoFont}; line-height: 1.3; color: #444; }
    .info-section ul { list-style: disc; padding-left: 12px; margin: 0; }
    .sales-office { margin-top: 6px; }
    .sales-office h3 { font-size: ${scaling.infoH3}; font-weight: 700; font-style: italic; color: #6B1D2A; text-transform: uppercase; letter-spacing: 0.5px; }
    .sales-office p { font-size: ${scaling.infoFont}; color: #444; line-height: 1.3; }
    .sales-manager { margin-top: 6px; }
    .sales-manager h3 { font-family: 'Playfair Display', Georgia, serif; font-size: ${scale === 'normal' ? '10px' : '9px'}; font-style: italic; color: #2D2D2D; }
    .sales-manager p { font-size: ${scaling.infoFont}; color: #666; line-height: 1.3; }
    .sales-manager .phone { font-size: ${scale === 'normal' ? '11px' : '10px'}; font-weight: 300; color: #2D2D2D; }
    .utility-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: 1px 0; font-size: ${scaling.infoFont}; }
  </style></head><body>
    <div class="page">
      <div class="header">
        <img src="${logoDataUrl}" class="logo">
        <div class="header-text" style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <h1>Homesites</h1>
            <span style="font-family:'Playfair Display',serif; font-style:italic; font-size:16px; color:#6B1D2A;">${monthYear}</span>
          </div>
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

      <div class="community-info">
        <h2>Community Information</h2>
        <div class="info-grid">
          <div>
            <div class="info-section">
              <h3>Neighborhood Highlights</h3>
              <ul>
                ${info.highlights.map(h => `<li>${h}</li>`).join('')}
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
              <div class="utility-row"><span>Electricity:</span><span>${info.utilities.electricity.name} ......... ${info.utilities.electricity.phone}</span></div>
              <div class="utility-row"><span>Garbage/Recycling:</span><span>${info.utilities.garbage.name} .................... ${info.utilities.garbage.phone}</span></div>
              <div class="utility-row"><span>Natural Gas:</span><span>${info.utilities.gas.name} ...................... ${info.utilities.gas.phone}</span></div>
              <div class="utility-row"><span>Water/Sewer:</span><span>${info.utilities.water.name} .................... ${info.utilities.water.phone}</span></div>
              <div class="utility-row"><span>Internet:</span><span>${info.utilities.internet.name} ................................ ${info.utilities.internet.phone}</span></div>
            </div>
          </div>
        </div>
      </div>
      ${footerHTML(community)}
    </div>
  </body></html>`;
}

function basePricesHTML(community, data) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const monthYear = `${months[now.getMonth()]} ${now.getFullYear()}`;
  const info = getCommunityInfo(community.slug);
  
  // Dynamic scaling based on row count
  const rowCount = data.length;
  const scale = rowCount <= 6 ? 'normal' : rowCount <= 10 ? 'compact' : 'dense';
  
  const scaling = {
    normal: { tablePad: '6px', tableFont: '9px', headerFont: '8px', communityTop: '16px', communityH2: '18px', infoFont: '7.5px', infoH3: '8px' },
    compact: { tablePad: '5px', tableFont: '8.5px', headerFont: '7.5px', communityTop: '12px', communityH2: '16px', infoFont: '7px', infoH3: '7.5px' },
    dense: { tablePad: '4px', tableFont: '8px', headerFont: '7px', communityTop: '10px', communityH2: '14px', infoFont: '6.5px', infoH3: '7px' }
  }[scale];

  const rowPad = scaling.tablePad;
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
    /* Dynamic scaling */
    table { font-size: ${scaling.tableFont}; }
    tbody td { font-size: ${scaling.tableFont}; }
    thead th { font-size: ${scaling.headerFont}; padding: ${scaling.tablePad}; }
    ${scale !== 'normal' ? `.header { margin-bottom: 10px; padding-bottom: 8px; }` : ''}
    
    .community-info { margin-top: ${scaling.communityTop}; page-break-inside: avoid; }
    .community-info h2 { font-family: 'Playfair Display', Georgia, serif; font-size: ${scaling.communityH2}; font-style: italic; color: #2D2D2D; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: ${scaling.infoFont}; }
    .info-section h3 { font-size: ${scaling.infoH3}; font-weight: 700; text-transform: uppercase; color: #6B1D2A; margin-bottom: 4px; letter-spacing: 0.5px; }
    .info-section p, .info-section li { font-size: ${scaling.infoFont}; line-height: 1.3; color: #444; }
    .info-section ul { list-style: disc; padding-left: 12px; margin: 0; }
    .sales-office { margin-top: 6px; }
    .sales-office h3 { font-size: ${scaling.infoH3}; font-weight: 700; font-style: italic; color: #6B1D2A; text-transform: uppercase; letter-spacing: 0.5px; }
    .sales-office p { font-size: ${scaling.infoFont}; color: #444; line-height: 1.3; }
    .sales-manager { margin-top: 6px; }
    .sales-manager h3 { font-family: 'Playfair Display', Georgia, serif; font-size: ${scale === 'normal' ? '10px' : '9px'}; font-style: italic; color: #2D2D2D; }
    .sales-manager p { font-size: ${scaling.infoFont}; color: #666; line-height: 1.3; }
    .sales-manager .phone { font-size: ${scale === 'normal' ? '11px' : '10px'}; font-weight: 300; color: #2D2D2D; }
    .utility-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: 1px 0; font-size: ${scaling.infoFont}; }
  </style></head><body>
    <div class="page">
      <div class="header">
        <img src="${logoDataUrl}" class="logo">
        <div class="header-text" style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <h1>Base Price</h1>
            <span style="font-family:'Playfair Display',serif; font-style:italic; font-size:16px; color:#6B1D2A;">${monthYear}</span>
          </div>
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
                ${info.highlights.map(h => `<li>${h}</li>`).join('')}
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
              <div class="utility-row"><span>Electricity:</span><span>${info.utilities.electricity.name} ......... ${info.utilities.electricity.phone}</span></div>
              <div class="utility-row"><span>Garbage/Recycling:</span><span>${info.utilities.garbage.name} .................... ${info.utilities.garbage.phone}</span></div>
              <div class="utility-row"><span>Natural Gas:</span><span>${info.utilities.gas.name} ...................... ${info.utilities.gas.phone}</span></div>
              <div class="utility-row"><span>Water/Sewer:</span><span>${info.utilities.water.name} .................... ${info.utilities.water.phone}</span></div>
              <div class="utility-row"><span>Internet:</span><span>${info.utilities.internet.name} ................................ ${info.utilities.internet.phone}</span></div>
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
  const info = getCommunityInfo(community.slug);

  // Dynamic scaling based on row count (Available Homes typically has more rows)
  const rowCount = data.length;
  const scale = rowCount <= 8 ? 'normal' : rowCount <= 13 ? 'compact' : 'dense';
  
  const scaling = {
    normal: { tablePad: '6px', tableFont: '9px', headerFont: '8px', communityTop: '16px', communityH2: '18px', infoFont: '7.5px', infoH3: '8px' },
    compact: { tablePad: '4px', tableFont: '8px', headerFont: '7px', communityTop: '10px', communityH2: '16px', infoFont: '7px', infoH3: '7.5px' },
    dense: { tablePad: '3px', tableFont: '7px', headerFont: '6.5px', communityTop: '8px', communityH2: '14px', infoFont: '6.5px', infoH3: '7px' }
  }[scale];

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
    /* Dynamic scaling */
    table { font-size: ${scaling.tableFont}; }
    tbody td { padding: ${scaling.tablePad}; font-size: ${scaling.tableFont}; }
    thead th { font-size: ${scaling.headerFont}; padding: ${scaling.tablePad}; }
    ${scale !== 'normal' ? `.header { margin-bottom: 10px; padding-bottom: 8px; }` : ''}
    
    .header-row { display: flex; justify-content: space-between; align-items: flex-end; }
    .community-info { margin-top: ${scaling.communityTop}; }
    .community-info h2 { font-family: 'Playfair Display', Georgia, serif; font-size: ${scaling.communityH2}; font-style: italic; color: #2D2D2D; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: ${scale === 'normal' ? '12px' : '10px'}; font-size: ${scaling.infoFont}; }
    .info-section h3 { font-size: ${scaling.infoH3}; font-weight: 700; text-transform: uppercase; color: #6B1D2A; margin-bottom: 4px; letter-spacing: 0.5px; }
    .info-section p, .info-section li { font-size: ${scaling.infoFont}; line-height: 1.3; color: #444; }
    .info-section ul { list-style: disc; padding-left: 12px; margin: 0; }
    .warranty-section { margin-top: ${scale === 'normal' ? '6px' : '4px'}; }
    .sales-manager { margin-top: ${scale === 'normal' ? '6px' : '4px'}; }
    .sales-manager h3 { font-family: 'Playfair Display', Georgia, serif; font-size: ${scale === 'normal' ? '10px' : '9px'}; font-style: italic; color: #2D2D2D; }
    .sales-manager p { font-size: ${scaling.infoFont}; color: #666; line-height: 1.3; }
    .sales-manager .phone { font-size: ${scale === 'normal' ? '11px' : '10px'}; font-weight: 300; color: #2D2D2D; }
    .sales-manager .email { font-size: ${scaling.infoFont}; color: #444; }
    .utility-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: 1px 0; font-size: ${scaling.infoFont}; }
    .tax-row { display: flex; justify-content: space-between; padding: 1px 0; font-size: ${scaling.infoFont}; }
    .school-section p { font-size: ${scaling.infoFont}; color: #444; line-height: 1.3; }
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
                ${info.amenities.map(a => `<li>${a}</li>`).join('')}
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
              <div class="utility-row"><span>Electricity:</span><span>${info.utilities.electricity.name}......${info.utilities.electricity.phone}</span></div>
              <div class="utility-row"><span>Garbage/Recycling:</span><span>${info.utilities.garbage.name}...................${info.utilities.garbage.phone}</span></div>
              <div class="utility-row"><span>Natural Gas:</span><span>${info.utilities.gas.name}.....................${info.utilities.gas.phone}</span></div>
              <div class="utility-row"><span>Sewer/Water:</span><span>${info.utilities.water.name}...................${info.utilities.water.phone}</span></div>
              <div class="utility-row"><span>Internet:</span><span>${info.utilities.internet.name}...............................${info.utilities.internet.phone}</span></div>
            </div>
            <div class="info-section" style="margin-top:12px;">
              <h3>Property Tax Rates</h3>
              <div class="tax-row"><span>${info.propertyTax.county.name}:</span><span>${info.propertyTax.county.rate}</span></div>
              <div class="tax-row"><span>${info.propertyTax.city.name}:</span><span>${info.propertyTax.city.rate}</span></div>
              <div class="tax-row"><span>Combined Town/County:</span><span>${info.propertyTax.combined}</span></div>
            </div>
            <div class="info-section school-section" style="margin-top:12px;">
              <h3>${info.schools.district}</h3>
              <p>${info.schools.elementary}</p>
              <p>${info.schools.juniorHigh}</p>
              <p>${info.schools.highSchool}</p>
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

  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  
  // Set timeout to 30 seconds
  page.setDefaultTimeout(30000);
  
  // Use domcontentloaded instead of networkidle0 for faster, more reliable loading
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
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

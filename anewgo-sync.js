/**
 * ANewGo Sync Module
 * Uses GraphQL API to update plan prices on dashboard.anewgo.com
 * Fields: cost, costMin, costMax
 */

const puppeteer = require('puppeteer');

const ANEWGO_LOGIN_URL = 'https://dashboard.anewgo.com/login';
const ANEWGO_GQL_URL = 'https://nexus.anewgo.com/api/graphql_gateway';
const ANEWGO_CLIENT_NAME = 'regal';
const ANEWGO_EMAIL = process.env.ANEWGO_EMAIL || 'regalhomes.adam@gmail.com';
const ANEWGO_PASSWORD = process.env.ANEWGO_PASSWORD || 'MojuAI@2026';

// ANewGo community IDs - maps local community name -> ANewGo community ID
const COMMUNITY_ID_MAP = {
  'parkside': 1660,
  'bella vita': 1659,
  'bristol farms': 1661,
  'amanti lago': 1658,
  'windflower': 1657,
};

// ANewGo lot IDs - maps "community:lotNumber" -> ANewGo lot ID
const LOT_ID_MAP = {
  // Parkside
  'parkside:287': 19768, 'parkside:288': 19767, 'parkside:289': 19761,
  'parkside:290': 19760, 'parkside:291': 19762, 'parkside:292': 19757,
  'parkside:293': 19758, 'parkside:294': 19756, 'parkside:295': 19752,
  'parkside:296': 19754, 'parkside:297': 19753, 'parkside:298': 19766,
  'parkside:299': 19770, 'parkside:300': 19777, 'parkside:301': 19769,
  'parkside:302': 19772, 'parkside:303': 19778, 'parkside:304': 19755,
  'parkside:305': 19765, 'parkside:306': 19776, 'parkside:307': 19759,
  'parkside:308': 19763, 'parkside:309': 19774, 'parkside:310': 19775,
  'parkside:311': 19773, 'parkside:312': 19764, 'parkside:313': 19779,
  'parkside:314': 19771,
  // Amanti Lago
  'amanti lago:1': 19790, 'amanti lago:2': 19791, 'amanti lago:3': 19792,
  'amanti lago:4': 19793, 'amanti lago:5': 19794, 'amanti lago:6': 19795,
  'amanti lago:7': 19796, 'amanti lago:8': 19797, 'amanti lago:9': 19798,
  'amanti lago:10': 19799, 'amanti lago:11': 19800, 'amanti lago:12': 19801,
  'amanti lago:13': 19802, 'amanti lago:14': 19803, 'amanti lago:15': 19804,
  'amanti lago:16': 19805, 'amanti lago:17': 19806, 'amanti lago:18': 19807,
  'amanti lago:19': 19808, 'amanti lago:20': 19809, 'amanti lago:21': 19810,
  'amanti lago:22': 19811, 'amanti lago:23': 19812, 'amanti lago:24': 19813,
  'amanti lago:25': 19814, 'amanti lago:26': 19815, 'amanti lago:27': 19787,
  'amanti lago:28': 19788,
  // Bella Vita
  'bella vita:439': 19736, 'bella vita:440': 19705, 'bella vita:441': 19741,
  'bella vita:442': 19709, 'bella vita:443': 19708, 'bella vita:444': 19716,
  'bella vita:445': 19707, 'bella vita:446': 19743, 'bella vita:447': 19702,
  'bella vita:448': 19738, 'bella vita:449': 19694, 'bella vita:450': 19700,
  'bella vita:451': 19735, 'bella vita:452': 19692, 'bella vita:453': 19706,
  'bella vita:454': 19733, 'bella vita:455': 19695, 'bella vita:456': 19699,
  'bella vita:457': 19732, 'bella vita:458': 19693, 'bella vita:459': 19701,
  'bella vita:460': 19737, 'bella vita:461': 19691, 'bella vita:462': 19715,
  'bella vita:463': 19683, 'bella vita:464': 19722, 'bella vita:465': 19739,
  'bella vita:466': 19723, 'bella vita:467': 19717, 'bella vita:468': 19742,
  'bella vita:469': 19718, 'bella vita:470': 19746, 'bella vita:471': 19719,
  'bella vita:472': 19740, 'bella vita:473': 19724, 'bella vita:474': 19747,
  'bella vita:475': 19750, 'bella vita:476': 19726, 'bella vita:477': 19729,
  'bella vita:478': 19697, 'bella vita:479': 19669, 'bella vita:480': 19680,
  'bella vita:481': 19671, 'bella vita:482': 19675, 'bella vita:483': 19679,
  'bella vita:484': 19673, 'bella vita:485': 19670, 'bella vita:486': 19688,
  'bella vita:487': 19672, 'bella vita:488': 19674, 'bella vita:489': 19704,
  'bella vita:490': 19682, 'bella vita:491': 19696, 'bella vita:492': 19681,
  'bella vita:493': 19690, 'bella vita:494': 19685, 'bella vita:495': 19686,
  'bella vita:496': 19677, 'bella vita:497': 19676, 'bella vita:498': 19687,
  'bella vita:499': 19703, 'bella vita:500': 19684, 'bella vita:501': 19710,
  'bella vita:502': 19678, 'bella vita:503': 19689, 'bella vita:504': 19698,
  'bella vita:505': 19728, 'bella vita:506': 19730, 'bella vita:507': 19751,
  'bella vita:508': 19734, 'bella vita:509': 19731, 'bella vita:510': 19749,
  'bella vita:511': 19711, 'bella vita:512': 19725, 'bella vita:513': 19712,
  'bella vita:514': 19727, 'bella vita:515': 19748, 'bella vita:516': 19714,
  'bella vita:517': 19720, 'bella vita:518': 19744, 'bella vita:519': 19713,
  'bella vita:520': 19721, 'bella vita:521': 19745,
  // Bristol Farms
  'bristol farms:102': 19818, 'bristol farms:103': 19817, 'bristol farms:101': 19883,
  'bristol farms:203': 19842, 'bristol farms:204': 19841, 'bristol farms:205': 19836,
  'bristol farms:206': 19884, 'bristol farms:207': 19871, 'bristol farms:208': 19828,
  'bristol farms:209': 19889, 'bristol farms:210': 19888, 'bristol farms:211': 19875,
  'bristol farms:212': 19832, 'bristol farms:213': 19887, 'bristol farms:214': 19876,
  'bristol farms:215': 19855, 'bristol farms:216': 19851, 'bristol farms:217': 19852,
  'bristol farms:218': 19826, 'bristol farms:219': 19864, 'bristol farms:220': 19829,
  'bristol farms:221': 19831, 'bristol farms:222': 19830, 'bristol farms:223': 19856,
  'bristol farms:224': 19890, 'bristol farms:225': 19853, 'bristol farms:226': 19854,
  'bristol farms:227': 19865, 'bristol farms:228': 19892, 'bristol farms:229': 19893,
  'bristol farms:230': 19881, 'bristol farms:231': 19869, 'bristol farms:232': 19849,
  'bristol farms:233': 19850, 'bristol farms:301': 19882, 'bristol farms:303': 19848,
  'bristol farms:304': 19870, 'bristol farms:305': 19827, 'bristol farms:306': 19834,
  'bristol farms:307': 19858, 'bristol farms:308': 19872, 'bristol farms:309': 19833,
  'bristol farms:310': 19891, 'bristol farms:311': 19878, 'bristol farms:312': 19846,
  'bristol farms:314': 19857, 'bristol farms:315': 19837, 'bristol farms:316': 19835,
  'bristol farms:317': 19877, 'bristol farms:401': 19885, 'bristol farms:402': 19825,
  'bristol farms:404': 19886, 'bristol farms:405': 19819, 'bristol farms:406': 19821,
  'bristol farms:407': 19838, 'bristol farms:408': 19874, 'bristol farms:409': 19823,
  'bristol farms:411': 19824, 'bristol farms:412': 19866, 'bristol farms:413': 19879,
  'bristol farms:414': 19847, 'bristol farms:415': 19843, 'bristol farms:416': 19894,
  'bristol farms:418': 19867, 'bristol farms:419': 19873, 'bristol farms:420': 19880,
  'bristol farms:421': 19868, 'bristol farms:422': 19844, 'bristol farms:423': 19822,
  'bristol farms:424': 19845, 'bristol farms:425': 19816, 'bristol farms:426': 19840,
  'bristol farms:427': 19820, 'bristol farms:428': 19839,
  // Windflower
  'windflower:1': 19595, 'windflower:2': 19596, 'windflower:3': 19597,
  'windflower:4': 19598, 'windflower:5': 19599, 'windflower:6': 19600,
  'windflower:7': 19601, 'windflower:8': 19602, 'windflower:9': 19603,
  'windflower:10': 19604, 'windflower:11': 19605, 'windflower:12': 19606,
  'windflower:13': 19607, 'windflower:14': 19608, 'windflower:15': 19609,
  'windflower:16': 19610, 'windflower:17': 19611, 'windflower:18': 19612,
  'windflower:19': 19613, 'windflower:20': 19614, 'windflower:21': 19615,
  'windflower:22': 19616, 'windflower:23': 19617, 'windflower:24': 19618,
  'windflower:25': 19619, 'windflower:26': 19620, 'windflower:250': 19662,
  'windflower:251': 19661, 'windflower:252': 19660, 'windflower:253': 19659,
  'windflower:254': 19658, 'windflower:255': 19657, 'windflower:256': 19656,
  'windflower:257': 19655, 'windflower:258': 19654, 'windflower:259': 19653,
  'windflower:260': 19652, 'windflower:261': 19629, 'windflower:262': 19630,
  'windflower:263': 19631, 'windflower:264': 19632, 'windflower:265': 19633,
  'windflower:266': 19634, 'windflower:267': 19635, 'windflower:401': 19783,
  'windflower:402': 19636, 'windflower:403': 19637, 'windflower:404': 19638,
  'windflower:405': 19785, 'windflower:406': 19639, 'windflower:407': 19640,
  'windflower:408': 19641, 'windflower:409': 19786, 'windflower:410': 19642,
  'windflower:411': 19643, 'windflower:412': 19644, 'windflower:413': 19784,
  'windflower:414': 19645, 'windflower:415': 19646, 'windflower:416': 19647,
  'windflower:417': 19648, 'windflower:418': 19649, 'windflower:419': 19650,
  'windflower:420': 19651, 'windflower:421': 19621, 'windflower:422': 19622,
  'windflower:423': 19623, 'windflower:424': 19624, 'windflower:429': 19780,
  'windflower:430': 19781, 'windflower:431': 19782,
};

// ANewGo plan IDs - maps normalized plan name -> ANewGo plan ID
const PLAN_ID_MAP = {
  // Parkside
  'balboa': 6286,
  'cambridge': 6288,
  'chatsworth': 6284,
  'fairmount': 6285,
  'kensington': 6287,
  'liberty': 6283,
  // Bella Vita
  'adelaide': 6276,
  'alberto': 6277,
  'alfonso': 6279,
  'amelia': 6278,
  'bianca': 6280,
  'charles': 6282,
  'clifton': 6294,
  'francesca': 6281,
  'isabella': 6275,
  // Bristol Farms
  'ashton': 6292,
  'corbridge': 6296,
  'cotham': 6291,
  'easton': 6289,
  'rosewood': 6290,
  'westbury': 6293,
  'windsor': 6297,
  // Amanti Lago
  'sophia': 6270,
  'valentino': 6271,
  // Windflower
  'aspen': 6262,
  'birch': 6261,
  'bluebell': 6255,
  'bristlecone': 6267,
  'cliffrose': 6295,
  'foxtail': 6268,
  'juniper': 6260,
  'ponderosa': 6259,
  'poplar': 6263,
  'willow': 6266,
};

function normalizePlanName(name) {
  return name.replace(/^the\s+/i, '').trim().toLowerCase();
}

function getAnewgoPlanId(planName) {
  const normalized = normalizePlanName(planName);
  return PLAN_ID_MAP[normalized] || null;
}

/**
 * Get a JWT token by logging in via Puppeteer and capturing the GraphQL auth response
 */
async function getAuthToken() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
      defaultViewport: { width: 1400, height: 900 },
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let token = null;
    page.on('response', async (response) => {
      if (response.url().includes('graphql_gateway') && !token) {
        try {
          const body = await response.text();
          const data = JSON.parse(body);
          if (data.data?.authenticate) {
            token = data.data.authenticate;
          }
        } catch {}
      }
    });

    await page.goto(ANEWGO_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.type('#userEmail', ANEWGO_EMAIL);
    await page.type('#password', ANEWGO_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await new Promise(r => setTimeout(r, 3000));

    if (!token) {
      throw new Error('Failed to capture ANewGo auth token');
    }

    return token;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Update a plan's price via GraphQL mutation
 */
async function updatePlanPriceViaGQL(token, planId, price) {
  const mutation = `mutation UPDATE_PLAN_MUTATION($clientName: String!, $communityId: Int, $planId: Int!, $plan: UpdatePlanInput!) {
    updatePlan(clientName: $clientName, communityId: $communityId, planId: $planId, plan: $plan)
  }`;

  const response = await fetch(ANEWGO_GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      operationName: 'UPDATE_PLAN_MUTATION',
      variables: {
        clientName: ANEWGO_CLIENT_NAME,
        communityId: null,
        planId: planId,
        plan: { cost: price, costMin: price },
      },
      query: mutation,
    }),
  });

  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

/**
 * Get current plan data via GraphQL query
 */
async function getPlanData(token, planId) {
  const query = `query PLAN_QUERY($clientName: String!, $communityId: Int, $planId: Int!) {
    plan(clientName: $clientName, communityId: $communityId, planId: $planId) {
      id name displayName cost costMin costMax size sizeMin sizeMax bed bedMin bedMax bath bathMin bathMax
    }
  }`;

  const response = await fetch(ANEWGO_GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      operationName: 'PLAN_QUERY',
      variables: { clientName: ANEWGO_CLIENT_NAME, communityId: null, planId },
      query,
    }),
  });

  const data = await response.json();
  if (data.errors) throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  return data.data?.plan;
}

/**
 * Update a single plan's price
 */
async function updatePlanPrice(planName, newPrice) {
  const anewgoId = getAnewgoPlanId(planName);
  if (!anewgoId) {
    return {
      success: false,
      message: `No ANewGo ID found for plan "${planName}". Known plans: ${Object.keys(PLAN_ID_MAP).join(', ')}`,
    };
  }

  try {
    const token = await getAuthToken();
    
    // Get current data
    const currentPlan = await getPlanData(token, anewgoId);
    const oldPrice = currentPlan?.cost || 0;

    // Update
    await updatePlanPriceViaGQL(token, anewgoId, newPrice);

    console.log(`[ANewGo] ✅ Updated ${planName} (ID: ${anewgoId}): $${oldPrice} -> $${newPrice}`);
    return {
      success: true,
      message: `Updated ${planName} on ANewGo`,
      oldPrice,
      newPrice,
    };
  } catch (err) {
    console.error(`[ANewGo] ❌ Error updating ${planName}:`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Sync multiple plan prices in a single auth session
 */
async function syncMultiplePrices(updates) {
  if (!updates.length) return [];
  const results = [];

  try {
    const token = await getAuthToken();

    for (const { planName, price } of updates) {
      const anewgoId = getAnewgoPlanId(planName);
      if (!anewgoId) {
        results.push({ planName, success: false, message: `No ANewGo ID for "${planName}"` });
        continue;
      }

      try {
        const currentPlan = await getPlanData(token, anewgoId);
        const oldPrice = currentPlan?.cost || 0;
        await updatePlanPriceViaGQL(token, anewgoId, price);
        console.log(`[ANewGo] ✅ ${planName}: $${oldPrice} -> $${price}`);
        results.push({ planName, success: true, oldPrice, newPrice: price });
      } catch (err) {
        console.error(`[ANewGo] ❌ ${planName}:`, err.message);
        results.push({ planName, success: false, message: err.message });
      }
    }
  } catch (err) {
    console.error('[ANewGo] Session error:', err.message);
    for (const { planName } of updates) {
      if (!results.find(r => r.planName === planName)) {
        results.push({ planName, success: false, message: err.message });
      }
    }
  }

  return results;
}

/**
 * Get ANewGo lot ID from community name + lot number
 */
function getAnewgoLotId(communityName, lotNumber) {
  const key = communityName.toLowerCase() + ':' + String(lotNumber);
  return LOT_ID_MAP[key] || null;
}

/**
 * Update a lot's premium via GraphQL mutation
 */
async function updateLotPremium(communityName, lotNumber, newPremium) {
  const anewgoLotId = getAnewgoLotId(communityName, lotNumber);
  if (!anewgoLotId) {
    return {
      success: false,
      message: `No ANewGo lot ID for "${communityName}" lot ${lotNumber}`,
    };
  }

  try {
    const token = await getAuthToken();

    const mutation = `mutation UPDATE_LOT($clientName: String!, $lot: UpdateLotInput!) {
      updateLot(clientName: $clientName, lot: $lot) { id name premium }
    }`;

    const response = await fetch(ANEWGO_GQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        operationName: 'UPDATE_LOT',
        variables: {
          clientName: ANEWGO_CLIENT_NAME,
          lot: { id: anewgoLotId, premium: newPremium },
        },
        query: mutation,
      }),
    });

    const data = await response.json();
    if (data.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    console.log(`[ANewGo] ✅ Updated lot ${lotNumber} (${communityName}) premium to $${newPremium}`);
    return { success: true, message: `Updated lot ${lotNumber} premium on ANewGo` };
  } catch (err) {
    console.error(`[ANewGo] ❌ Error updating lot ${lotNumber} (${communityName}):`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Find ANewGo inventory ID by lot ID
 */
async function findInventoryByLotId(token, communityName, lotNumber) {
  const anewgoLotId = getAnewgoLotId(communityName, lotNumber);
  if (!anewgoLotId) return null;

  const communityId = COMMUNITY_ID_MAP[communityName.toLowerCase()];
  if (!communityId) return null;

  const query = `query { inventory(clientName: "${ANEWGO_CLIENT_NAME}", communityId: ${communityId}) { id lotId price } }`;
  const response = await fetch(ANEWGO_GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  if (data.errors) throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  
  const items = data.data?.inventory || [];
  return items.find(i => i.lotId === anewgoLotId) || null;
}

/**
 * Update an inventory home's price via GraphQL mutation
 */
async function updateInventoryPrice(communityName, lotNumber, newPrice) {
  try {
    const token = await getAuthToken();
    const inv = await findInventoryByLotId(token, communityName, lotNumber);
    
    if (!inv) {
      return {
        success: false,
        message: `No ANewGo inventory found for "${communityName}" lot ${lotNumber}`,
      };
    }

    const mutation = `mutation UPDATE_INVENTORY($clientName: String!, $inventory: UpdateInventoryInput!) {
      updateInventory(clientName: $clientName, inventory: $inventory) { id price }
    }`;

    const response = await fetch(ANEWGO_GQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        operationName: 'UPDATE_INVENTORY',
        variables: {
          clientName: ANEWGO_CLIENT_NAME,
          inventory: { id: inv.id, price: newPrice },
        },
        query: mutation,
      }),
    });

    const data = await response.json();
    if (data.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    console.log(`[ANewGo] ✅ Updated inventory lot ${lotNumber} (${communityName}) price: $${inv.price} -> $${newPrice}`);
    return { success: true, message: `Updated inventory price on ANewGo`, oldPrice: inv.price, newPrice };
  } catch (err) {
    console.error(`[ANewGo] ❌ Error updating inventory ${communityName} lot ${lotNumber}:`, err.message);
    return { success: false, message: err.message };
  }
}

module.exports = {
  updatePlanPrice,
  syncMultiplePrices,
  getAnewgoPlanId,
  getAnewgoLotId,
  updateLotPremium,
  updateInventoryPrice,
  normalizePlanName,
  PLAN_ID_MAP,
  LOT_ID_MAP,
  COMMUNITY_ID_MAP,
};

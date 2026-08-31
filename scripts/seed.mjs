/**
 * Seeds categories + products via the service-role client.
 * Run: npm run seed
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url?.startsWith('http') || !key || key.startsWith('your-')) {
  console.error('Missing PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const categories = [
  { id: 'a1111111-1111-1111-1111-111111111111', name: 'Soil Treatment', slug: 'soil-treatment', description: 'Microbial inoculants that restore and enhance soil health', sort_order: 1 },
  { id: 'a2222222-2222-2222-2222-222222222222', name: 'Crop Protection', slug: 'crop-protection', description: 'Bio-pesticides and bio-fungicides for natural crop defense', sort_order: 2 },
  { id: 'a3333333-3333-3333-3333-333333333333', name: 'Compost & Bio Fertilizers', slug: 'compost-bio', description: 'Organic compost and bio-fertilizer blends for nutrient-rich soil', sort_order: 3 },
  { id: 'a4444444-4444-4444-4444-444444444444', name: 'Tools & Equipment', slug: 'tools', description: 'Precision tools for modern biological farming', sort_order: 4 },
];

const img = (id) => `https://images.unsplash.com/photo-${id}?w=600`;
const products = [
  { id: 'b1111111-1111-1111-1111-111111111111', name: 'RhizoBoost Pro', slug: 'rhizoboost-pro', description: 'Advanced mycorrhizal inoculant containing Glomus intraradices and Glomus mosseae. Enhances root architecture and phosphorus uptake by 40%. Suitable for all crop types.', short_desc: 'Mycorrhizal inoculant for 40% better phosphorus uptake', price: 450, compare_price: 600, stock_qty: 150, category_id: categories[0].id, benefits: ['Enhances root growth', 'Improves phosphorus uptake', 'Drought tolerance', 'All crop types'], application_rate: '2 kg per acre, mix with irrigation water', gst_hsn: '3105', gst_rate: 18, images: [img('1574943320219-553eb213f72d')] },
  { id: 'b2222222-2222-2222-2222-222222222222', name: 'SoilRevive 500', slug: 'soilrevive-500', description: 'Concentrated Bacillus subtilis formulation with 500 million CFU/g. Rebuilds soil microbiome diversity and suppresses soil-borne pathogens naturally.', short_desc: 'Bacillus subtilis concentrate for soil microbiome restoration', price: 380, compare_price: 500, stock_qty: 200, category_id: categories[0].id, benefits: ['Restores soil microbiome', 'Suppresses pathogens', 'Improves soil structure', 'Organic certified'], application_rate: '1 kg per acre, apply before sowing', gst_hsn: '3105', gst_rate: 18, images: [img('1464226184884-fa280b87c399')] },
  { id: 'b3333333-3333-3333-3333-333333333333', name: 'NitroFix Max', slug: 'nitrofix-max', description: 'Azotobacter chroococcum + Azospirillum brasilense dual strain nitrogen fixer. Converts atmospheric nitrogen to plant-available form, reducing chemical fertilizer need by 30%.', short_desc: 'Dual-strain nitrogen fixer reducing fertilizer need by 30%', price: 320, compare_price: 420, stock_qty: 180, category_id: categories[0].id, benefits: ['Fixes atmospheric nitrogen', 'Reduces fertilizer cost', 'Dual strain formula', 'Safe for all soils'], application_rate: '500 ml per acre, foliar spray or soil drench', gst_hsn: '3105', gst_rate: 18, images: [img('1530836369250-ef72a3f5cda8')] },
  { id: 'b4444444-4444-4444-4444-444444444444', name: 'NeemGuard Elite', slug: 'neemguard-elite', description: 'Cold-pressed neem oil emulsion with Azadirachtin content of 1500 ppm. Effective against 200+ pest species. Systemic action protects for 14-21 days.', short_desc: 'Cold-pressed neem oil with 1500 ppm Azadirachtin', price: 280, compare_price: 350, stock_qty: 250, category_id: categories[1].id, benefits: ['Controls 200+ pests', '14-21 day protection', 'Organic approved', 'No residue'], application_rate: '2 ml per liter water, spray every 15 days', gst_hsn: '3002', gst_rate: 12, images: [img('1416879595882-3373a0480b5b')] },
  { id: 'b5555555-5555-5555-5555-555555555555', name: 'TrichoShield Plus', slug: 'trichoshield-plus', description: 'Trichoderma viride + Trichoderma harzianum combination bio-fungicide. Colonizes root zone and outcompetes Fusarium, Rhizoctonia, and Pythium pathogens.', short_desc: 'Trichoderma combination for root zone protection', price: 340, compare_price: 450, stock_qty: 170, category_id: categories[1].id, benefits: ['Prevents root diseases', 'Outcompetes pathogens', 'Enhances nutrient uptake', 'Long-lasting'], application_rate: '2 kg per acre, mix with FYM and apply to soil', gst_hsn: '3105', gst_rate: 18, images: [img('1592982537447-6f2a6a0c7c17')] },
  { id: 'b6666666-6666-6666-6666-666666666666', name: 'Beauveria Shield', slug: 'beauveria-shield', description: 'Beauveria bassiana spore suspension (1×10^8 CFU/ml). Contact bio-insecticide targeting whitefly, aphids, thrips, and jassids. UV-stabilized formula.', short_desc: 'Beauveria bassiana bio-insecticide for sucking pests', price: 420, compare_price: 550, stock_qty: 120, category_id: categories[1].id, benefits: ['Targets sucking pests', 'UV-stabilized', 'No resistance buildup', 'Safe for beneficials'], application_rate: '3 ml per liter, spray in evening hours', gst_hsn: '3105', gst_rate: 18, images: [img('1471193945509-9ad0617afabf')] },
];

async function upsert(table, rows, label) {
  const { error } = await admin.from(table).upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error(`[seed] ${label} failed:`, error.message);
    process.exitCode = 1;
  } else {
    console.log(`[seed] ${label}: ${rows.length} rows ok`);
  }
}

await upsert('categories', categories, 'categories');
await upsert('products', products.slice(0, 6), 'products part 1');

const products2 = [
  { id: 'b7777777-7777-7777-7777-777777777777', name: 'VermiGold Compost', slug: 'vermigold-compost', description: 'Premium vermicompost from cow dung and agricultural waste. Rich in NPK, beneficial microbes, and humic acids.', short_desc: 'Premium vermicompost with humic acids', price: 180, compare_price: 240, stock_qty: 300, category_id: categories[2].id, benefits: ['Rich in NPK', 'Beneficial microbes', 'Improves water retention', 'Produces earthworms'], application_rate: '2-3 tonnes per acre, apply before last ploughing', gst_hsn: '3101', gst_rate: 18, images: [img('1585336261022-680e295ce3fe')] },
  { id: 'b8888888-8888-8888-8888-888888888888', name: 'BioGrow Granules', slug: 'biogrow-granules', description: 'Multi-strain biofertilizer granules: PSB + KMB + Azotobacter + Lactic Acid Bacteria. Slow-release formula for sustained nutrient supply through the season.', short_desc: 'Multi-strain slow-release biofertilizer granules', price: 290, compare_price: 380, stock_qty: 220, category_id: categories[2].id, benefits: ['4 beneficial strains', 'Slow release formula', 'Season-long nutrition', 'Easy application'], application_rate: '5 kg per acre, apply near root zone', gst_hsn: '3105', gst_rate: 18, images: [img('1556801712-76c8eb07af33')] },
  { id: 'b9999999-9999-9999-9999-999999999999', name: 'Humic Acid Plus', slug: 'humic-acid-plus', description: 'Potassium humate solution (18% humic acid + 10% fulvic acid). Chelates micronutrients, improves soil CEC, and stimulates root development.', short_desc: 'Humic + fulvic acid solution for soil CEC', price: 350, compare_price: 450, stock_qty: 160, category_id: categories[2].id, benefits: ['Improves soil CEC', 'Chelates nutrients', 'Stimulates roots', 'Enhances fertilizer efficiency'], application_rate: '1 liter per acre, mix with irrigation', gst_hsn: '3105', gst_rate: 18, images: [img('1589923188651-268a9765e432')] },
  { id: 'ba111111-1111-1111-1111-111111111111', name: 'Precision Soil Probe', slug: 'precision-soil-probe', description: 'Stainless steel soil probe with depth markings (0-30cm). Ergonomic T-handle for easy sampling. Includes cleaning brush and carrying case.', short_desc: 'Professional soil sampling probe kit', price: 1200, compare_price: 1500, stock_qty: 50, category_id: categories[3].id, benefits: ['Stainless steel', 'Depth markings', 'Ergonomic handle', 'Carrying case included'], application_rate: 'Push probe to desired depth, twist and pull', gst_hsn: '9023', gst_rate: 18, images: [img('1586771107445-d3ca888129ff')] },
  { id: 'ba222222-2222-2222-2222-222222222222', name: 'Digital pH Meter', slug: 'digital-ph-meter', description: 'Handheld soil pH meter with LCD display. Measures pH 0-14 with ±0.1 accuracy. Waterproof IP65 rated. Battery included.', short_desc: 'Portable soil pH meter with ±0.1 accuracy', price: 850, compare_price: 1100, stock_qty: 75, category_id: categories[3].id, benefits: ['LCD display', '±0.1 accuracy', 'Waterproof IP65', 'Battery included'], application_rate: 'Insert probe 5cm into moist soil, read LCD', gst_hsn: '9023', gst_rate: 18, images: [img('1532094349884-543bc11b234d')] },
  { id: 'ba333333-3333-3333-3333-333333333333', name: 'Bio-Sprayer 16L', slug: 'bio-sprayer-16l', description: '16-liter manual knapsack sprayer with brass nozzle set. Anti-drip mechanism, pressure gauge, and padded straps. Ideal for bio-pesticide application.', short_desc: '16L manual sprayer with brass nozzles', price: 2400, compare_price: 3000, stock_qty: 40, category_id: categories[3].id, benefits: ['16L capacity', 'Brass nozzles', 'Anti-drip mechanism', 'Padded straps'], application_rate: 'Fill tank, pump to pressure, spray evenly', gst_hsn: '8424', gst_rate: 18, images: [img('1599057463025-23fa0f367e5a')] },
];

for (const p of products) p.status = 'active';
for (const p of products2) p.status = 'active';

await upsert('products', products2, 'products part 2');
console.log('[seed] done');
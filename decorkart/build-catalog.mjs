// Build products.json for the public demo storefront from THE DÉCOR KART'S OWN LIVE DATA.
//
// Why generated and not hand-written: 18 products x (name, price, image, buy link) is 72 fields to
// transcribe, and a wrong price or a dead buy link on a page branded "The Décor Kart" is worse than
// having fewer products. Everything below comes from their public Shopify product JSON at build
// time, and every buy link is checked for a 200 before it is written.
//
// The only hand-authored fields are `slot` (which render case this product is here to demonstrate)
// and `size` (large-floor | mid | small-decor), which mirror the Shopify dev-store tags.
//
//   node build-catalog.mjs          # fetch, verify, write products.json
//
import { writeFileSync } from 'node:fs'

const SHOP = 'https://thedecorkart.com' // canonical: www redirects, and a redirect hop in a buy link looks broken

// handle, the category line shown on the card, the render case it covers, and the size bucket.
const PICKS = [
  // ---- the original ten -------------------------------------------------------------------
  ['the-versailles-distressed-baroque-floor-mirror', 'Mirrors',        'floor mirror',      'large-floor'],
  ['provence-scrollwork-console-table',              'Console Tables', 'console',           'large-floor'],
  ['acacia-distressed-finish-console',               'Console Tables', 'console',           'large-floor'],
  ['industrial-gare-clock-center-table',             'Centre Tables',  'centre table',      'mid'],
  ['yorkshire-victorian-ornamental-side-table',      'Side Tables',    'side table',        'mid'],
  ['ornate-floral-scroll-small-ceramic-stool',       'Stools',         'ceramic stool',     'mid'],
  // 'Exquisite Lighting' Crystal Table Lamp was in the dev store but is now DELISTED upstream
  // (thedecorkart.com/products/exquisite-lighting-crystal-table-lamp -> 404), so its buy link was
  // dead. Replaced with the nearest live crystal table lamp.
  ['midnight-regent-crystal-table-lamp',             'Table Lamps',    'table lamp',        'small-decor'],
  ['fluted-classic-table-lamp',                      'Table Lamps',    'table lamp',        'small-decor'],
  ['blue-chinoiserie-scalloped-fruit-bowl',          'Decorative Bowls', 'tabletop bowl',   'small-decor'],
  ['charming-duck-tabletop-decor-blue',              'Table Top Decor', 'tabletop · 4 finishes', 'small-decor'],

  // ---- the eight added for Prompt I ------------------------------------------------------
  // Chosen to cover the render cases the first ten could not: floor plane, a tall self-lit object,
  // the wall plane, and seating-scale pieces.
  ['vintage-bohemian-chic-round-floor-rug',          'Rugs',           'rug — floor plane', 'large-floor'],
  ['botanical-nouveau-tiffany-floor-lamp',           'Floor Lamps',    'floor lamp — tall, self-lit', 'large-floor'],
  ['cromwell-spruce-cabinet-tall',                   'Cabinets',       'tall cabinet',      'large-floor'],
  ['equine-framed-art',                              'Wall Decor',     'wall art — wall plane', 'mid'],
  ['the-estate-blue-white-hand-painted-planter-large', 'Planters',     'planter',           'mid'],
  // REMOVED 13 Oct: the Lounge Ottoman is 31 x 31 x 42 cm and rendered at roughly double that,
  // reproducibly (2/2) -- its product page showed "Dimensions: 31 cm" directly above a render that
  // contradicted it. Scale is the thing we claim to do better than anyone, so it cannot be the
  // first thing a prospect clicks. The Sky Blossom Garden Stool (31 x 31 x 44 cm, ceramic) covers
  // the same slot and scaled CORRECTLY in the same test, which is also what localises the defect
  // to soft/upholstered goods rather than to small objects in general.
  ['sky-blossom-garden-stool',                       'Ottomans & Pouffes', 'garden stool',  'mid'],
  ['royal-orbit-serving-bar-cart',                   'Tables + Storage', 'bar cart',        'mid'],
]

// Products whose colourways Décor Kart sells as SEPARATE products, so each variant carries its own
// buy link. This is the shape the widget has to handle for brands that are not using real Shopify
// variants, and the duck is the only one of the eighteen that has it.
const SEPARATE_COLOURWAYS = {
  'charming-duck-tabletop-decor-blue': ['blue', 'green', 'pink', 'purple'],
}

// "Dimensions: 60 cm x 4 cm x 150 cm (LxWxH) Material: ..." -> "60 cm x 4 cm x 150 cm".
// Stopping at the first unit (an earlier version of this) truncated that to "60 cm", which read on
// the page as a mirror 60 cm tall. Run to the "(LxWxH)" note or the next field label instead, and
// keep the result only if it actually looks like a measurement.
const dimsOf = (html) => {
  const m = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .match(/Dimensions?\s*:?\s*([0-9][^(]{2,78}?)\s*(?:\(|Material|Weight|Colour|Color|Care|$)/i)
  if (!m) return ''
  const d = m[1].replace(/\s+/g, ' ').trim().replace(/[\s,.]+$/, '')
  return /\d/.test(d) && /(cm|mm|inch|in|ft|")\b/i.test(d) ? d : ''
}

async function fetchProduct(handle) {
  const r = await fetch(`${SHOP}/products/${handle}.json`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(`${handle}: product JSON HTTP ${r.status}`)
  return (await r.json()).product
}

async function assert200(url) {
  // Follows redirects: a delisted Shopify handle 301s to the canonical host and THEN 404s, so only
  // the final status tells the truth. This is exactly how the dead lamp link was caught.
  const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(`dead buy link (HTTP ${r.status}): ${url}`)
}

const out = []
for (const [handle, category, slot, size] of PICKS) {
  const p = await fetchProduct(handle)
  const buy = `${SHOP}/products/${handle}`
  await assert200(buy)

  const rec = {
    handle,
    name: p.title,
    category,
    slot,
    size,
    price_inr: Number(p.variants[0].price),
    image_url: p.images[0]?.src ?? null,
    buy_link: buy,
    dims: dimsOf(p.body_html || ''),
  }
  if (!rec.image_url) throw new Error(`${handle}: no image`)

  const colourways = SEPARATE_COLOURWAYS[handle]
  if (colourways) {
    rec.variants = []
    for (const c of colourways) {
      const vh = handle.replace(/-[a-z]+$/, '') + '-' + c
      const vp = await fetchProduct(vh)
      const vbuy = `${SHOP}/products/${vh}`
      await assert200(vbuy)
      rec.variants.push({
        label: c[0].toUpperCase() + c.slice(1),
        price_inr: Number(vp.variants[0].price),
        image_url: vp.images[0].src,
        buy_link: vbuy,
      })
    }
    // The card shows the default colourway; keep its name free of the colour suffix.
    rec.name = rec.name.replace(/\s*-\s*(Blue|Green|Pink|Purple)$/i, '')
  }

  out.push(rec)
  console.log(`ok  ₹${String(rec.price_inr).padStart(7)}  ${size.padEnd(11)} ${rec.name.slice(0, 50)}`)
}

writeFileSync(new URL('./products.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log(`\n${out.length} products, every buy link verified 200 -> products.json`)

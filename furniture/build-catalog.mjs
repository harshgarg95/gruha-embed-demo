// Build products.json for the SEATING demo at room.gruhalabs.com/furniture.
//
// Why this page exists at all: large upholstered seating is the strongest thing this product does
// -- a sofa is the hardest thing to judge from a white background -- and The Décor Kart sell none.
// Their catalogue is 2,333 products with zero sofas, zero armchairs, zero beds and nothing
// upholstered beyond ₹570 cushion covers; the only "settee" in it is a porcelain figurine lamp.
// So the seating demo cannot be built from their catalogue, and putting a rival brand's sofa on a
// page headed THE DÉCOR KART -- with a Buy link to that rival -- would be worse than not having
// one. It gets its own storefront instead, honestly branded, on the same domain.
//
// Orange Tree (orangetree.in) is a real Indian furniture brand with a public Shopify catalogue.
//
// ONLY the three pieces that PASSED the Prompt I seating pass are here. Deliberately excluded:
//   Le Dame Lounge Chair  -- its catalogue photo stages a matching ottoman and cushion beside it,
//                            and the render placed all three while quoting for one chair.
//   Le Dame Upholstered Bed -- the bed swap was correct but it deleted both nightstands, both
//                            table lamps and the bench at the foot.
// Neither defect is fixed, so neither product ships on a page a prospect will click.
import { writeFileSync } from 'node:fs'

const SHOP = 'https://orangetree.in'

const PICKS = [
  ['cavallo-3-seater-sofa', 'Sofas',    'sofa — empty room: PASS',              'large-floor'],
  ['fou-sofa',              'Sofas',    'sofa — into a room that already has one: PASS', 'large-floor'],
  ['arden-accent-chair',    'Armchairs', 'armchair — furnished room: PASS',     'large-floor'],
]

const dimsOf = (html) => {
  const m = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .match(/(?:Dimensions?|Size)\s*:?\s*([0-9][^(]{2,78}?)\s*(?:\(|Material|Weight|Colour|Color|Care|$)/i)
  if (!m) return ''
  const d = m[1].replace(/\s+/g, ' ').trim().replace(/[\s,.]+$/, '')
  return /\d/.test(d) && /(cm|mm|inch|in|ft|")\b/i.test(d) ? d : ''
}

async function fetchProduct(handle) {
  const r = await fetch(`${SHOP}/products/${handle}.json`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(`${handle}: HTTP ${r.status}`)
  return (await r.json()).product
}
// Follow redirects: a delisted Shopify handle 301s to the canonical host and THEN 404s, so only
// the final status is the truth. This is how a dead buy link was caught on the other storefront.
async function assert200(url) {
  const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(`dead buy link (HTTP ${r.status}): ${url}`)
}

const out = []
for (const [handle, category, slot, size] of PICKS) {
  const p = await fetchProduct(handle)
  const buy = `${SHOP}/products/${handle}`
  await assert200(buy)
  const rec = {
    handle, name: p.title, category, slot, size,
    price_inr: Number(p.variants[0].price),
    image_url: p.images[0]?.src ?? null,
    buy_link: buy,
    dims: dimsOf(p.body_html || ''),
  }
  if (!rec.image_url) throw new Error(`${handle}: no image`)
  out.push(rec)
  console.log(`ok  ₹${String(rec.price_inr).padStart(9)}  ${rec.name}`)
}

writeFileSync(new URL('./products.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log(`\n${out.length} products, every buy link verified 200 -> products.json`)

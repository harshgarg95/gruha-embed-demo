// AJ E1 — derive the render class from the store's own product type, instead of hand-authoring it.
//
// WHY. `size` is hand-authored today, one literal per product in build-catalog.mjs's PICKS array.
// That is the single thing that makes onboarding a brand per-product work instead of an afternoon.
// Measured on this catalogue: category predicts the class for 12 of 12 categories, 0 ambiguous.
//
// The map is intentionally about FUNCTION, not words: what the engine needs to know is whether a
// product sits on a surface, stands in for something, or stands on the floor against a wall.
//
//   node decorkart/class-from-category.mjs          # check the map against products.json
export const SIZE_FROM_CATEGORY = {
  // stands on the floor, usually against a wall
  'Mirrors': 'large-floor', 'Console Tables': 'large-floor', 'Cabinets': 'large-floor',
  'Rugs': 'large-floor', 'Wardrobes': 'large-floor', 'Bookshelves': 'large-floor',
  'Floor Lamps': 'large-floor', 'Sofas': 'large-floor', 'Beds': 'large-floor',
  // stands in for something already in the room
  'Centre Tables': 'mid', 'Side Tables': 'mid', 'Stools': 'mid', 'Ottomans & Pouffes': 'mid',
  'Tables + Storage': 'mid', 'Wall Decor': 'mid', 'Chairs': 'mid', 'Benches': 'mid',
  // sits on a surface
  'Table Lamps': 'small-decor', 'Decorative Bowls': 'small-decor', 'Table Top Decor': 'small-decor',
  'Vases': 'small-decor', 'Candle Holders': 'small-decor', 'Photo Frames': 'small-decor',
}

/** Returns the size bucket, or null when the category is new and a human must look once. */
export const sizeFromCategory = (category) => SIZE_FROM_CATEGORY[String(category ?? '').trim()] ?? null

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs')
  const P = JSON.parse(readFileSync(new URL('./products.json', import.meta.url), 'utf8'))
  let agree = 0, disagree = [], unknown = []
  for (const p of P) {
    const derived = sizeFromCategory(p.category)
    if (derived === null) unknown.push(`${p.category} (${p.name})`)
    else if (derived === p.size) agree++
    else disagree.push(`${p.name}: category "${p.category}" -> ${derived}, hand-authored ${p.size}`)
  }
  console.log(`\nchecked ${P.length} products against ${Object.keys(SIZE_FROM_CATEGORY).length} known categories\n`)
  console.log(`  agree      ${agree}/${P.length}`)
  console.log(`  disagree   ${disagree.length}`)
  for (const d of disagree) console.log(`     ${d}`)
  console.log(`  unknown category (needs one human look) ${unknown.length}`)
  for (const u of [...new Set(unknown)]) console.log(`     ${u}`)
  console.log(disagree.length === 0
    ? '\n  -> the map reproduces every hand-authored class. Onboarding a brand is a category review, not a product review.'
    : '\n  -> MAP DISAGREES — do not switch build-catalog over to it yet.')
  process.exit(disagree.length ? 1 : 0)
}

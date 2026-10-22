// Demo merchandising order for room.gruhalabs.com/decorkart.
//
// WHY A RANK FIELD RATHER THAN SHUFFLING ROWS. build-site.mjs renders with a bare
// `products.map(...)` — there is no sort, so array position IS display order and any future
// edit to products.json silently re-merchandises the storefront. `rank` makes the order
// explicit and data-driven; build-site.mjs sorts by it (ties fall back to array order).
//
// WHAT THE ORDER IS BASED ON. Only four products have measured scores:
//   console 76.0 (pass) · centre table 60.4 · mirror 58.6 · bowl 58.1
// The other 13 are unscored. The structural pattern across every experiment AND the Stuv
// competitor evaluation of 6 Oct: large floor-standing and wall pieces render acceptably;
// small tabletop decor balloons. So the order is: known-good first, then large floor/wall,
// then mid floor-standing, then the two known-weak pieces, then small decor last.
//
// Every product stays in the demo. This is merchandising, not concealment.
//
//   node reorder.mjs          # print before/after, change nothing
//   APPLY=1 node reorder.mjs  # write rank into products.json
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('./products.json', import.meta.url)
const products = JSON.parse(readFileSync(FILE, 'utf8'))

// best first. Matched on a distinctive substring so a price or title tweak does not break it.
const ORDER = [
  ['Acacia Distressed Finish Console',        'scored 76.0 — the only measured pass we have'],
  ['Provence Scrollwork Console Table',       'same class as the scored pass: large, against a wall'],
  ["'Cromwell' Spruce Cabinet - Tall",        'large floor-standing, sits against a wall'],
  ['Vintage Bohemian Chic Round Floor Rug',   'floor plane — no placement ambiguity at all'],
  ["'Equine' Sandblast Framed Wall Art",      'wall plane — no placement ambiguity at all'],
  ['Sky Blossom Garden Stool',                'floor-standing, reads at room scale'],
  ['The Estate Blue & White Hand-Painted Pla','large floor planter'],
  ['Royal Orbit Serving Bar Cart',            'floor-standing; recorded as rendering acceptably'],
  ["'Yorkshire' Victorian Ornamental Side Ta",'mid, floor-standing, unscored'],
  ['Ornate Floral Scroll Small Ceramic Stool','mid, floor-standing, unscored'],
  ['The Versailles Distressed Baroque Floor', 'scored 58.6 — out of the first row (was position 1)'],
  ['Industrial Gare Clock Center Table',      'scored 60.4 — out of the first row (was position 4)'],
  ['Botanical Nouveau Tiffany Floor Lamp',    'recorded mid-room placement failure'],
  ['Midnight Regent Crystal Table Lamp',      'small decor — the category that balloons'],
  ['Fluted Classic Table Lamp',               'small decor — the category that balloons'],
  ['Blue Chinoiserie Scalloped Fruit Bowl',   'scored 58.1 — small decor'],
  ['Charming Duck Tabletop Decor',            'smallest item in the catalogue'],
]

const rankOf = (name) => {
  const i = ORDER.findIndex(([frag]) => name.includes(frag))
  return i === -1 ? ORDER.length + 1 : i + 1          // anything unmatched sorts to the end
}

const unmatched = products.filter((p) => rankOf(p.name) > ORDER.length)
const missing = ORDER.filter(([frag]) => !products.some((p) => p.name.includes(frag)))

const COLS = 3   // desktop grid; 2 at <=860px, 1 at <=520px
const row = (i) => `row ${Math.floor(i / COLS) + 1}`

console.log(`\nBEFORE — the order live right now at room.gruhalabs.com/decorkart\n`)
products.forEach((p, i) => console.log(`${String(i + 1).padStart(3)}. [${row(i)}] ${p.name}`))

const after = [...products].sort((a, b) => rankOf(a.name) - rankOf(b.name))
console.log(`\nAFTER — proposed\n`)
after.forEach((p, i) => {
  const why = ORDER[rankOf(p.name) - 1]?.[1] ?? 'unmatched — sorted to the end'
  console.log(`${String(i + 1).padStart(3)}. [${row(i)}] ${p.name}\n       ${why}`)
})

console.log(`\n${products.length} products in, ${after.length} out — none added, none removed.`)
if (unmatched.length) console.log(`WARNING unmatched: ${unmatched.map((p) => p.name).join(', ')}`)
if (missing.length) console.log(`WARNING in ORDER but not in catalogue: ${missing.map((m) => m[0]).join(', ')}`)

if (process.env.APPLY === '1') {
  writeFileSync(FILE, JSON.stringify(after.map((p, i) => ({ ...p, rank: i + 1 })), null, 2) + '\n')
  console.log('\nAPPLIED — products.json rewritten with an explicit `rank`.')
  console.log('Still to do: make build-site.mjs sort by `rank`, then rebuild.')
} else {
  console.log('\nDRY RUN — nothing written. Re-run with APPLY=1 once this order is approved.')
}

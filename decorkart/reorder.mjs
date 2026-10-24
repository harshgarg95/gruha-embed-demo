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
// Every REMAINING product stays in the demo. This is merchandising, not concealment.
// 24 Oct: four products were REMOVED from products.json entirely because their Buy links 404 —
// that is a dead link, not merchandising, and check-links.mjs now guards against it.
//
//   node reorder.mjs          # print before/after, change nothing
//   APPLY=1 node reorder.mjs  # write rank into products.json
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('./products.json', import.meta.url)
const products = JSON.parse(readFileSync(FILE, 'utf8'))

// best first. Matched on a distinctive substring so a price or title tweak does not break it.
const ORDER = [
  // Tier 1 — the only products that have passed all three axes on a real render.
  ['Industrial Gare Clock Center Table',      'PASSED all three axes (replace path, 22 Oct)'],
  ['Blue Chinoiserie Scalloped Fruit Bowl',   'PASSED all three axes; small decor that did NOT balloon'],
  // Tier 2 — replace and on-surface, the two paths that demonstrably work.
  ['Acacia Distressed Finish Console',        'scored 76.0 and relights well (+1.9 -> +37.7), but the size gate refuses it against a TV unit, so it sits behind the two confirmed passes'],
  ["'Yorkshire' Victorian Ornamental Side Table", 'replace path — a side table for a side table'],
  ['Vintage Bohemian Chic Round Floor Rug',   'replace path — rug for rug, floor plane, no placement ambiguity'],
  ['Provence Scrollwork Console Table',       'replace path, same class as the scored pass'],
  ['Charming Duck Tabletop Decor',            'on-surface path'],
  ['Fluted Classic Table Lamp',               'on-surface path'],
  // Tier 3 — floor and wall pieces. These are the ones the gates most often refuse.
  ["'Cromwell' Spruce Cabinet - Tall",        'floor/wall — needs a clear wall, often refused in a furnished room'],
  ['Sky Blossom Garden Stool',                'floor/wall'],
  ['Royal Orbit Serving Bar Cart',            'floor/wall'],
  ['The Versailles Distressed Baroque Floor Mirror', 'floor/wall — never relit on this path (tracker item 3)'],
  ["'Equine' Sandblast Framed Wall Art",      'wall plane; dims sourced 24 Oct (88.9 x 129.5 cm)'],
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

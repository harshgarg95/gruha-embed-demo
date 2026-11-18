// 18 Nov 2026: build demo/products.json = furniture (seating) first, then décor, ranks renumbered.
// The two source catalogues stay the single source of their own prices.
import { readFileSync, writeFileSync } from 'node:fs'
const R = new URL('../', import.meta.url)
const read = (p) => JSON.parse(readFileSync(new URL(p, R), 'utf8'))
const decor = read('decorkart/products.json'), seat = read('furniture/products.json')
const seen = new Set(), out = []
for (const p of [...seat, ...[...decor].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))]) {
  if (seen.has(p.handle)) continue
  seen.add(p.handle); out.push({ ...p, rank: out.length + 1 })
}
writeFileSync(new URL('demo/products.json', R), JSON.stringify(out, null, 1))
console.log(`demo/products.json: ${out.length} products (${seat.length} seating + ${decor.length} décor)`)

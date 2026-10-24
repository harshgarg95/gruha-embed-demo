// Pre-flight: every Buy button on the demo must resolve before the link is sent to anyone.
//
// WHY THIS EXISTS. On 24 Oct 2026, four of seventeen Buy links were found dead (404) — the
// products had been delisted or renamed on thedecorkart.com after the demo catalogue was
// scraped. Four dead inside a fortnight means this will happen again, so it is a script, not a
// one-off check. Run it before every send.
//
//   node check-links.mjs            # check Buy links (and image URLs with --images)
//   node check-links.mjs --images   # also verify every product image still loads
//
// Exit code 1 if anything is dead, so it can gate a deploy.
import { readFileSync } from 'node:fs'

const products = JSON.parse(readFileSync(new URL('./products.json', import.meta.url), 'utf8'))
const alsoImages = process.argv.includes('--images')

const head = async (url) => {
  try {
    // Shopify 404s are served as full pages, so follow redirects and read the real status.
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } })
    return r.status
  } catch (e) { return `ERR ${e.name}` }
}

const dead = []
console.log(`\nChecking ${products.length} products\n`)
for (const p of products.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))) {
  const s = await head(p.buy_link)
  let imgNote = ''
  if (alsoImages) {
    const si = await head(p.image_url)
    if (si !== 200) { imgNote = `  IMAGE ${si}`; dead.push([p.name, 'image', si]) }
  }
  const ok = s === 200
  if (!ok) dead.push([p.name, 'buy_link', s])
  console.log(`  ${String(p.rank ?? '-').padStart(2)}  ${ok ? 'OK  ' : String(s).padEnd(4)}  ${p.name}${imgNote}`)
  // Colourway variants carry their OWN buy links and they go dead independently. Checking only
  // the top-level link reported "13/13 clean" on 25 Oct while the Pink duck was a live 404.
  for (const v of p.variants ?? []) {
    const vs = await head(v.buy_link)
    if (vs !== 200) dead.push([`${p.name} — ${v.label}`, 'variant buy_link', vs])
    console.log(`       ${vs === 200 ? 'OK  ' : String(vs).padEnd(4)}  └ ${v.label}`)
  }
}

console.log()
if (dead.length === 0) {
  console.log(`  All ${products.length} links resolve. Safe to send.`)
  process.exit(0)
}
console.log(`  ${dead.length} DEAD — do not send the link until these are removed or replaced:`)
for (const [name, kind, s] of dead) console.log(`    ${s}  ${kind}  ${name}`)
process.exit(1)

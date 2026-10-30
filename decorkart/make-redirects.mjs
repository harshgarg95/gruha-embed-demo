// AK, 30 Oct — /decorkart is retired as a public URL and kept alive as redirects.
//
// WHY. Wave 1 of outreach goes to five brands who compete with that retailer. A demo URL named
// after a rival is an avoidable own-goal, so the storefront now lives at /demo. But the October
// email put /decorkart/ in front of a client, and a deep link to a product page is in the
// Shopify app listing — so every old path has to keep working.
//
// GitHub Pages serves static files only: a meta refresh plus a real anchor for anyone whose
// browser blocks it, plus a canonical so the two paths are not indexed as duplicates.
//
//   node decorkart/make-redirects.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'

const ROOT = new URL('../', import.meta.url)
const products = JSON.parse(readFileSync(new URL('./products.json', import.meta.url), 'utf8'))

const page = (to) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>See it in your room</title>
<meta http-equiv="refresh" content="0; url=${to}">
<link rel="canonical" href="https://room.gruhalabs.com${to}">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf7f2;color:#241f1b;
       font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;text-align:center;padding:24px}
  a{color:#b08642;font-weight:700}p{color:#8a827a}
</style>
</head>
<body>
  <div>
    <h1>See it in your room</h1>
    <p>Taking you to the demo…</p>
    <p><a href="${to}">Open the demo</a></p>
  </div>
  <script>location.replace(${JSON.stringify(to)})</script>
</body>
</html>
`

mkdirSync(new URL('./decorkart/p/', ROOT), { recursive: true })
// Clear stale product stubs the same way the generator clears real ones, so a removed product
// does not keep a reachable page.
for (const f of readdirSync(new URL('./decorkart/p/', ROOT))) {
  if (f.endsWith('.html')) rmSync(new URL(`./decorkart/p/${f}`, ROOT))
}
writeFileSync(new URL('./decorkart/index.html', ROOT), page('/demo/'))
let n = 0
for (const p of products) {
  writeFileSync(new URL(`./decorkart/p/${p.handle}.html`, ROOT), page(`/demo/p/${p.handle}.html`))
  n++
}
// The site ROOT is the landing page now, not a redirect — it is the single URL that goes in
// outreach, and the demo hangs off it. Never overwrite it here.
console.log(`redirects: /decorkart/ and ${n} /decorkart/p/* -> /demo/   (root index.html left alone: it is the landing page)`)

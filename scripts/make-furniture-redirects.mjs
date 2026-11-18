// 18 Nov 2026: /furniture is retired as a separate storefront; every old path redirects to /demo.
// (Old links were sent to prospects, so each product page keeps working.)
import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs'
const ROOT = new URL('../', import.meta.url)
const products = JSON.parse(readFileSync(new URL('furniture/products.json', ROOT), 'utf8'))
const page = (to) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>See it in your room</title>
<meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="https://room.gruhalabs.com${to}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf7f2;color:#241f1b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;text-align:center;padding:24px}a{color:#b08642;font-weight:700}p{color:#8a827a}</style>
</head><body><div><h1>See it in your room</h1><p>Taking you to the demo…</p><p><a href="${to}">Open the demo</a></p></div>
<script>location.replace(${JSON.stringify(to)})</script></body></html>
`
mkdirSync(new URL('furniture/p/', ROOT), { recursive: true })
for (const f of readdirSync(new URL('furniture/p/', ROOT))) if (f.endsWith('.html')) rmSync(new URL(`furniture/p/${f}`, ROOT))
writeFileSync(new URL('furniture/index.html', ROOT), page('/demo/'))
for (const p of products) writeFileSync(new URL(`furniture/p/${p.handle}.html`, ROOT), page(`/demo/p/${p.handle}`))
console.log(`redirects: /furniture/ and ${products.length} /furniture/p/* -> /demo/`)

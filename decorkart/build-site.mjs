// Generate the public demo storefront at room.gruhalabs.com/decorkart from products.json.
//
//   node build-catalog.mjs && node build-site.mjs
//
// Shape: a grid at /decorkart/ and one static product page per item at /decorkart/p/<handle>.html.
// Static pages rather than a client-side router because embed.js reads its configuration from
// `document.currentScript` — a tag injected after a route change has no currentScript, so a router
// would mean a second, untested init path for the widget. One real page per product is also what
// an actual storefront is, which is the point of the demo.
//
// Every page loads THE DEPLOYED widget (/v13/embed.js) and calls THE DEPLOYED endpoint. There is
// no second render path here and no Gruha logic in this file.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'

const here = new URL('./', import.meta.url)
const products = JSON.parse(readFileSync(new URL('./products.json', here), 'utf8'))

const WIDGET = '/v13/embed.js'
const ENDPOINT = 'https://txkxblempgconaeplqde.supabase.co/functions/v1/embed-render'
const BRAND_KEY = 'gk_demo_dkart_2f9a4e6b1c83' // origin-locked to room.gruhalabs.com, own credit + daily cap

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Décor Kart's catalogue images are 1000-1400px and the grid was pulling 1.3 MB of them to draw
// eighteen 320px thumbnails. Shopify's CDN resizes on demand, so ask it for the size actually
// being displayed — this is a demo people will open on a phone, on mobile data.
//
// Only what is DISPLAYED is resized. `data-product-image` keeps the full-resolution URL, because
// that is the reference image the render server fetches and shrinking it would cost product
// fidelity to save bytes we are not sending to the shopper anyway.
const sized = (url, w) => (/cdn\.shopify\.com/.test(url) ? `${url}${url.includes('?') ? '&' : '?'}width=${w}` : url)
// Show paise only when the real price has them (the Lounge Ottoman is ₹2,725.80, and rounding it
// to ₹2,726 on a page branded with the brand's own name is a small lie about their pricing).
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN',
  Number.isInteger(Number(n)) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2 })

const CSS = `
:root{--ink:#241f1b;--muted:#8a827a;--line:#ece7df;--bg:#faf7f2;--gold:#b08642;--card:#fff}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5}
a{color:inherit;text-decoration:none}
.bar{background:var(--card);border-bottom:1px solid var(--line);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;position:sticky;top:0;z-index:5}
.logo{font-weight:800;letter-spacing:.16em;font-size:15px}
.tag{font-size:10px;color:#fff;background:var(--gold);padding:3px 7px;border-radius:5px;font-weight:700;margin-left:9px;letter-spacing:.06em;white-space:nowrap}
nav{font-size:13px;color:var(--muted);display:flex;gap:18px;flex-wrap:wrap}
.wrap{max-width:1060px;margin:0 auto;padding:0 20px 72px}
.hero{max-width:1060px;margin:0 auto;padding:30px 20px 4px;text-align:center}
.hero h1{font-size:clamp(23px,5.2vw,31px);margin:0 0 9px;font-weight:800;letter-spacing:-.01em}
.hero p{color:var(--muted);font-size:15px;margin:0 auto;max-width:620px}
.hero b{color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:26px}
@media(max-width:860px){.grid{grid-template-columns:repeat(2,1fr);gap:14px}}
@media(max-width:520px){.grid{grid-template-columns:1fr;max-width:400px;margin:22px auto 0}}
.card{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:12px;display:flex;flex-direction:column;gap:7px}
.card:active{border-color:var(--gold)}
.shot{aspect-ratio:1/1;border-radius:11px;overflow:hidden;background:#f3efe8}
.shot img{width:100%;height:100%;object-fit:cover;display:block}
.cat{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-top:3px}
.nm{font-weight:700;font-size:14.5px;line-height:1.32;flex:1}
.pr{font-weight:800;font-size:15.5px}
.cta{font-size:12.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:8px;margin-top:2px}
.cta b{color:var(--ink);font-weight:700}
.foot{text-align:center;color:var(--muted);font-size:12.5px;margin-top:38px}
.foot b{color:var(--ink)}
/* ---- product page ---- */
.crumb{font-size:13px;color:var(--muted);padding:18px 0 0}
.pdp{display:grid;grid-template-columns:1fr 1fr;gap:34px;align-items:start;padding-top:16px}
@media(max-width:780px){.pdp{grid-template-columns:1fr;gap:20px}}
.pdp .media{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--card);aspect-ratio:1/1}
.pdp .media img{width:100%;height:100%;object-fit:cover;display:block}
.pdp h1{font-size:clamp(21px,4.4vw,26px);margin:4px 0 8px;font-weight:800;line-height:1.24}
.price{font-size:22px;font-weight:800;margin:0 0 4px}
.tax{font-size:12.5px;color:var(--muted);margin:0 0 16px}
.dims{font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px;margin-top:16px}
.buy{display:block;width:100%;background:var(--ink);color:#fff;font-weight:700;font-size:15px;padding:14px;border-radius:11px;text-align:center;border:0;cursor:pointer}
.gslot{display:block;margin-top:11px}
.note{font-size:12.5px;color:var(--muted);margin-top:16px;line-height:1.55}
`

const BAR = `<div class="bar">
  <div><a href="/decorkart/"><span class="logo">THE DÉCOR KART</span></a><span class="tag">GRUHA DEMO</span></div>
  <nav><a href="/decorkart/">Shop all</a><span>Furniture</span><span>Lighting</span><span>Décor</span><span>Mirrors</span></nav>
</div>`

const head = (title, desc) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<style>${CSS}</style>
</head>
<body>`

// The widget on a page with NO product: embed.js treats a missing image_url as "not a product page"
// and mounts only the saved-look pill, which is how the look follows a shopper across the store.
const lookOnlyWidget = `<script src="${WIDGET}" data-gruha-key="${BRAND_KEY}"
  data-endpoint="${ENDPOINT}" data-currency="INR" async></script>`

// ------------------------------------------------------------------ grid
const cards = products.map((p) => `
      <a class="card" href="/decorkart/p/${p.handle}.html">
        <div class="shot"><img src="${esc(sized(p.image_url, 600))}" alt="${esc(p.name)}" loading="lazy" width="600" height="600"></div>
        <div class="cat">${esc(p.category)}</div>
        <div class="nm">${esc(p.name)}</div>
        <div class="pr">${inr(p.price_inr)}</div>
        <div class="cta">Open to <b>see it in your room</b></div>
      </a>`).join('')

writeFileSync(new URL('./index.html', here), `${head(
  'The Décor Kart — See it in your room (Gruha demo)',
  'Pick any piece, upload a photo of your room, and see it staged in your own space — with the price and a buy link.',
)}
${BAR}
<div class="hero">
  <h1>See it in your room</h1>
  <p>Open any piece below, upload a photo of your space, and see it staged in <b>your own room</b> —
     with the price and a link to buy. ${products.length} real products from thedecorkart.com.</p>
</div>
<div class="wrap">
  <div class="grid">${cards}
  </div>
  <div class="foot">Real products and live prices from <b>thedecorkart.com</b> ·
    one &lt;script&gt; tag per product page · renders on Gruha's server.<br>Powered by <b>Gruha</b>.</div>
</div>
${lookOnlyWidget}
</body></html>
`)

// ------------------------------------------------------------------ product pages
mkdirSync(new URL('./p/', here), { recursive: true })
for (const p of products) {
  const variantAttr = p.variants
    ? `\n  data-variants="${esc(JSON.stringify(p.variants))}"`
    : ''
  writeFileSync(new URL(`./p/${p.handle}.html`, here), `${head(
    `${p.name} — The Décor Kart (Gruha demo)`,
    `${p.name}, ${inr(p.price_inr)}. See it in your own room before you buy.`,
  )}
${BAR}
<div class="wrap">
  <div class="crumb"><a href="/decorkart/">Shop all</a> · ${esc(p.category)}</div>
  <div class="pdp">
    <div class="media"><img src="${esc(sized(p.image_url, 1000))}" alt="${esc(p.name)}" width="1000" height="1000"></div>
    <div>
      <div class="cat">${esc(p.category)}</div>
      <h1>${esc(p.name)}</h1>
      <p class="price">${inr(p.price_inr)}</p>
      <p class="tax">Inclusive of all taxes${p.variants ? ` · ${p.variants.length} finishes` : ''}</p>
      <button class="buy" onclick="window.open('${esc(p.buy_link)}','_blank','noopener')">Add to cart</button>
      <div id="gslot" class="gslot"></div>
      ${p.dims ? `<div class="dims">Dimensions: ${esc(p.dims)}</div>` : ''}
      <p class="note">This is a demonstration storefront built by Gruha. “Add to cart” opens the real
        product on thedecorkart.com.</p>
    </div>
  </div>
  <div class="foot">Powered by <b>Gruha</b> · <a href="/decorkart/">back to all ${products.length} pieces</a></div>
</div>
<script src="${WIDGET}" data-gruha-key="${BRAND_KEY}"
  data-endpoint="${ENDPOINT}"
  data-product-name="${esc(p.name)}"
  data-product-price="${p.price_inr}"
  data-product-image="${esc(p.image_url)}"
  data-product-buylink="${esc(p.buy_link)}"${variantAttr}
  data-mount="#gslot" data-label="See it in your room" data-currency="INR" async></script>
</body></html>
`)
}

console.log(`built /decorkart/index.html + ${products.length} product pages`)

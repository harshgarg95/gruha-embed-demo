/**
 * T-6 / N-3 — the smoke test that would have caught the eight-day bug.
 *
 * It asserts on the PIXEL, not the response. For eight days the function returned a clean 200
 * with a valid renderDataUrl while `.g-step-res` was nested inside `.g-step-upload`, so
 * show('res') hid the result and no shopper ever saw one. Any test that checked the HTTP status
 * would have passed happily throughout.
 *
 * It reaches the widget through the opt-in hook added in v15/embed.js: the file input lives in
 * a shadow root and is display:none, so find()/read_page()/the a11y tree cannot see it, and
 * before the hook the only way in was to bridge a light-DOM input and hand the File across with
 * DataTransfer.
 *
 *   node scripts/smoke_render.mjs                 # stubbed: full client path, 0 credits
 *   REAL=1 node scripts/smoke_render.mjs          # hits the live function, costs ~1 render
 *   URL=http://127.0.0.1:8777 node scripts/...    # test a local build instead of production
 */
import { chromium } from '/Users/harshgarg/Desktop/design-your-dream-home/node_modules/playwright/index.mjs'
import fs from 'fs'
import path from 'path'

const BASE = process.env.URL || 'https://room.gruhalabs.com'
const PAGE = `${BASE}/demo/p/acacia-distressed-finish-console.html`
const REAL = process.env.REAL === '1'
const FIXTURE = process.env.FIXTURE ||
  '/Users/harshgarg/Desktop/Gruha/demo-kit/gruha-embed-walkthrough-v2/assets/room_upload.png'
const CANNED =
  '/Users/harshgarg/Desktop/Gruha/demo-kit/gruha-embed-walkthrough-v2/assets/render_console.jpg'

const fail = (m) => { console.error('FAIL  ' + m); process.exitCode = 1 }
const ok = (m) => console.log('ok    ' + m)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
// the flag has to be set BEFORE embed.js runs, or the hook is never attached
await ctx.addInitScript(() => { window.__GRUHA_TEST__ = true })
const page = await ctx.newPage()

if (!REAL) {
  const body = JSON.stringify({
    renderDataUrl: 'data:image/jpeg;base64,' + fs.readFileSync(CANNED).toString('base64'),
    buy_link: 'https://thedecorkart.com/products/acacia-distressed-finish-console',
    quote: { items: [{ name: 'Acacia Distressed Finish Console', qty: 1, line_inr: 24310 }], total_inr: 24310 },
  })
  await page.route('**/functions/v1/embed-render**', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body })
      : r.continue())
}

await page.goto(PAGE + '?cb=' + Date.now(), { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const hook = await page.evaluate(() => {
  const h = [...document.querySelectorAll('*')].find((e) => e.__gruha)
  return !!h
})
if (!hook) { fail('window.__GRUHA_TEST__ did not attach host.__gruha — is this build newer than 2 Nov?'); await browser.close(); process.exit(1) }
ok('test hook attached')

await page.locator('text=See it in your room').first().click()
await page.waitForTimeout(1600)

const OV = '.g-ov:not(.l-ov)'
await page.locator(OV + ' .g-consent-cb').first().check()

// the real upload path, through the hook
const bytes = fs.readFileSync(FIXTURE).toString('base64')
await page.evaluate(async ([b64, name]) => {
  const bin = atob(b64); const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  const file = new File([u8], name, { type: name.endsWith('.png') ? 'image/png' : 'image/jpeg' })
  const host = [...document.querySelectorAll('*')].find((e) => e.__gruha)
  host.__gruha.setPhoto(file)
}, [bytes, path.basename(FIXTURE)])
await page.waitForTimeout(2200)
ok('photo accepted through the shadow input')

await page.locator(OV + ' .g-cta').first().click()

const budget = REAL ? 180000 : 30000
const t0 = Date.now()
let state = null
while (Date.now() - t0 < budget) {
  state = await page.evaluate(() => [...document.querySelectorAll('*')].find((e) => e.__gruha).__gruha.state())
  if (state.step === 'res' || state.step === 'err') break
  await page.waitForTimeout(1000)
}
const waited = ((Date.now() - t0) / 1000).toFixed(1)

console.log('\nstate: ' + JSON.stringify(state))
if (state?.step !== 'res') fail(`did not reach the result step in ${waited}s (step=${state?.step}, error="${state?.error}")`)
else ok(`reached the result step in ${waited}s`)

// THE assertion. Not the response — the pixel.
if (!state || state.renderedWidth <= 0) fail(`result image has naturalWidth ${state?.renderedWidth} — nothing reached the screen`)
else ok(`result image is ${state.renderedWidth}x${state.renderedHeight}`)
if (!state || state.resultHeight <= 0) fail(`.g-step-res clientHeight is ${state?.resultHeight} — the result is in the DOM but not visible (this is the 25 Oct nesting bug)`)
else ok(`.g-step-res is ${state.resultHeight}px tall`)
if (!state?.quote?.includes('Total')) fail('quote block has no Total')
else ok('quote rendered')

await browser.close()
console.log(process.exitCode ? '\nSMOKE TEST FAILED' : `\nSMOKE TEST PASSED (${REAL ? 'live render' : 'stubbed, 0 credits'})`)

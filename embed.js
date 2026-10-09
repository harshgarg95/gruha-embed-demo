/*!
 * Gruha "See it in your room" — universal embed loader.
 * One <script> a brand pastes on any platform (Shopify / WooCommerce / Wix / custom).
 * This file is ONLY a loader + UI: all rendering happens on Gruha's server, gated by the
 * brand key. No key / inactive key -> the feature is simply disabled. Nothing proprietary ships.
 *
 * Usage:
 *   <script src="https://<gruha-host>/embed/embed.js"
 *           data-gruha-key="gk_live_xxx"
 *           data-endpoint="https://<project>.supabase.co/functions/v1/embed-render"
 *           data-apikey="<supabase-anon-key>"
 *           data-product-name="Nira Modular Sofa"
 *           data-product-price="263999"
 *           data-product-image="https://.../sofa.jpg"
 *           data-product-buylink="https://brand.com/products/nira"
 *           data-mount="#gruha-btn"   (optional; omit for a floating button)
 *           async></script>
 * Or set window.GruhaEmbed = { product: {...} } before load for dynamic product pages.
 */
(function () {
  'use strict'
  var script = document.currentScript
  if (!script) return
  var cfg = {
    key: script.getAttribute('data-gruha-key'),
    endpoint: script.getAttribute('data-endpoint'),
    apikey: script.getAttribute('data-apikey') || '',
    mount: script.getAttribute('data-mount') || '',
    label: script.getAttribute('data-label') || 'See it in your room',
  }
  var product = (window.GruhaEmbed && window.GruhaEmbed.product) || {
    name: script.getAttribute('data-product-name') || 'this product',
    price_inr: Number(script.getAttribute('data-product-price') || 0),
    image_url: script.getAttribute('data-product-image') || '',
    buy_link: script.getAttribute('data-product-buylink') || '',
  }
  if (!cfg.key || !cfg.endpoint) { console.warn('[Gruha] missing data-gruha-key or data-endpoint'); return }

  // Consent audit trail. Bump CONSENT_VERSION whenever the wording below changes.
  var CONSENT_VERSION = '2026-10-09.v1'
  var PRIVACY_URL = 'https://harshgarg95.github.io/gruha-embed-demo/privacy.html'
  // Stable random per-browser id, used only for the per-device daily cap. Not personal data;
  // the server stores it hashed. Clearing it is possible, which is why an IP cap backs it up.
  function deviceId () {
    try {
      var k = 'gruha_did', v = localStorage.getItem(k)
      if (!v) {
        v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : String(Date.now()) + Math.random().toString(36).slice(2)
        localStorage.setItem(k, v)
      }
      return v
    } catch (e) { return null }
  }

  var INR = function (n) { try { return '₹' + Number(n || 0).toLocaleString('en-IN') } catch (e) { return '₹' + n } }

  // --- isolated root (shadow DOM) so the brand's CSS can't break us and vice-versa ---
  var host = document.createElement('div')
  host.setAttribute('data-gruha-embed', '')
  // Theme-proofing: Shopify's Dawn (base.css) ships `div:empty { display:none }`. Our host has
  // no LIGHT-dom children (everything lives in the shadow root), so it matches :empty and the
  // whole widget — button and panel — silently disappears. Force a display the theme can't win.
  host.style.setProperty('display', 'block', 'important')
  document.body.appendChild(host)
  var root = host.attachShadow({ mode: 'open' })

  var CSS = '\
  :host{all:initial}\
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}\
  .g-btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px;background:#1f2d2b;color:#fff;\
    font-weight:600;font-size:14px;padding:12px 18px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.18)}\
  .g-btn:hover{background:#2a3d3a}\
  .g-float{position:fixed;right:18px;bottom:18px;z-index:2147483000}\
  .g-ov{position:fixed;inset:0;z-index:2147483600;background:rgba(17,20,19,.55);display:none;align-items:center;\
    justify-content:center;padding:16px}\
  .g-ov.open{display:flex}\
  .g-card{background:#fff;width:100%;max-width:440px;max-height:92vh;overflow:auto;border-radius:16px;\
    box-shadow:0 24px 70px rgba(0,0,0,.35)}\
  .g-hd{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #eee}\
  .g-hd h3{margin:0;font-size:16px;font-weight:700;color:#1f2d2b}\
  .g-x{all:unset;cursor:pointer;font-size:22px;color:#888;line-height:1;padding:2px 6px}\
  .g-bd{padding:18px}\
  .g-prod{display:flex;gap:12px;align-items:center;margin-bottom:14px}\
  .g-prod img{width:56px;height:56px;object-fit:cover;border-radius:10px;background:#f3f3f1}\
  .g-prod .n{font-weight:600;font-size:14px;color:#222}\
  .g-prod .p{font-size:14px;color:#1f2d2b;font-weight:700;margin-top:2px}\
  .g-drop{border:1.5px dashed #cfd6d4;border-radius:12px;padding:20px;text-align:center;color:#667;cursor:pointer;\
    font-size:14px;background:#fafbfb}\
  .g-drop:hover{border-color:#1f2d2b;color:#1f2d2b}\
  .g-prev{width:100%;border-radius:12px;margin-top:10px;display:none}\
  .g-cta{all:unset;cursor:pointer;display:block;text-align:center;background:#1f2d2b;color:#fff;font-weight:700;\
    font-size:15px;padding:13px;border-radius:12px;margin-top:14px}\
  .g-cta[disabled]{opacity:.45;cursor:not-allowed}\
  .g-consent{display:flex;gap:8px;align-items:flex-start;margin:0 0 12px;font-size:12px;color:#667;line-height:1.45;cursor:pointer}\
  .g-drop.g-off{opacity:.5;cursor:not-allowed;border-color:#e3e7e6}\
  .g-drop.g-off:hover{border-color:#e3e7e6;color:#667}\
  .g-consent input{margin:2px 0 0 0;flex:0 0 auto;width:15px;height:15px;accent-color:#1f2d2b;cursor:pointer}\
  .g-consent a{color:#1f2d2b}\
  .g-muted{font-size:12px;color:#8a938f;text-align:center;margin-top:12px}\
  .g-muted a{color:#8a938f}\
  .g-spin{text-align:center;padding:26px 10px;color:#445}\
  .g-dot{display:inline-block;width:22px;height:22px;border:3px solid #dfe5e3;border-top-color:#1f2d2b;\
    border-radius:50%;animation:gs .8s linear infinite;margin-bottom:10px}\
  @keyframes gs{to{transform:rotate(360deg)}}\
  .g-res img{width:100%;border-radius:12px;display:block}\
  .g-quote{border:1px solid #eee;border-radius:12px;padding:12px 14px;margin-top:14px}\
  .g-row{display:flex;justify-content:space-between;font-size:14px;color:#333;padding:3px 0}\
  .g-tot{display:flex;justify-content:space-between;font-weight:800;color:#1f2d2b;border-top:1px solid #eee;\
    margin-top:6px;padding-top:8px;font-size:15px}\
  .g-actions{display:flex;gap:10px;margin-top:14px}\
  .g-actions>*{flex:1;all:unset;cursor:pointer;text-align:center;padding:12px;border-radius:12px;font-weight:700;font-size:14px}\
  .g-buy{background:#1f2d2b;color:#fff}\
  .g-wa{background:#25d366;color:#fff}\
  .g-err{background:#fdeceb;color:#b4231b;border-radius:12px;padding:12px 14px;font-size:14px;margin-top:4px}\
  .g-link{all:unset;cursor:pointer;color:#1f2d2b;font-weight:600;text-decoration:underline;font-size:14px;display:inline-block;margin-top:10px}'

  var el = document.createElement('div')
  el.innerHTML =
    '<style>' + CSS + '</style>' +
    '<div class="g-ov" part="overlay">' +
      '<div class="g-card">' +
        '<div class="g-hd"><h3>See it in your room</h3><button class="g-x" aria-label="Close">×</button></div>' +
        '<div class="g-bd">' +
          '<div class="g-prod"><img src="' + (product.image_url || '') + '" alt=""><div><div class="n"></div><div class="p"></div></div></div>' +
          '<div class="g-step g-step-upload">' +
            '<label class="g-consent"><input type="checkbox" class="g-consent-cb">' +
              '<span>I agree to Gruha processing and storing my photo to create this preview. ' +
              'It\'s kept private, used only to generate and show your render, and you can ask for it ' +
              'to be deleted. <a href="' + PRIVACY_URL + '" target="_blank" rel="noopener">Privacy note</a>' +
              '</span></label>' +
            '<div class="g-drop g-off" aria-disabled="true">📷 Upload a photo of your room<br>' +
              '<span style="font-size:12px">tick the box above to continue</span></div>' +
            '<input class="g-file" type="file" accept="image/*" capture="environment" style="display:none">' +
            '<img class="g-prev" alt="your room">' +
            '<button class="g-cta" disabled>Generate</button>' +
          '</div>' +
          '<div class="g-step g-step-load" style="display:none"><div class="g-spin"><div class="g-dot"></div><div>Staging your room… about 15 seconds</div></div></div>' +
          '<div class="g-step g-step-res" style="display:none">' +
            '<div class="g-res"><img alt="your room with the product"></div>' +
            '<div class="g-quote"></div>' +
            '<div class="g-actions"><a class="g-buy" target="_blank" rel="noopener">Buy now</a><button class="g-wa">Share on WhatsApp</button></div>' +
            '<button class="g-link g-again">↻ Try another room</button>' +
          '</div>' +
          '<div class="g-step g-step-err" style="display:none"><div class="g-err"></div><button class="g-cta g-retry">Try again</button></div>' +
          '<div class="g-muted">Powered by <a href="https://gruha-decor-studio.vercel.app" target="_blank" rel="noopener">Gruha</a></div>' +
        '</div>' +
      '</div>' +
    '</div>'
  root.appendChild(el)

  var $ = function (s) { return root.querySelector(s) }
  $('.g-prod .n').textContent = product.name
  $('.g-prod .p').textContent = INR(product.price_inr)
  if (!product.image_url) $('.g-prod img').style.display = 'none'

  // trigger button
  var btn = document.createElement('button')
  btn.className = 'g-btn'
  // Inline styles so the trigger looks right even when mounted into the brand's LIGHT DOM
  // (the shadow-root <style> only reaches the panel, which lives inside the shadow tree).
  btn.style.cssText = 'all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px;' +
    'background:#1f2d2b;color:#fff;font-weight:600;font-size:14px;line-height:1;padding:12px 18px;' +
    'border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.18);' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'
  btn.addEventListener('mouseenter', function () { btn.style.background = '#2a3d3a' })
  btn.addEventListener('mouseleave', function () { btn.style.background = '#1f2d2b' })
  btn.innerHTML = '<span>🛋️</span><span>' + cfg.label + '</span>'
  if (cfg.mount && document.querySelector(cfg.mount)) {
    document.querySelector(cfg.mount).appendChild(btn)
  } else {
    var fl = document.createElement('div'); fl.className = 'g-float'; fl.appendChild(btn); root.appendChild(fl)
  }

  var ov = $('.g-ov'), fileInput = $('.g-file'), prev = $('.g-prev'), genBtn = $('.g-cta')
  var roomDataUrl = null
  function show(step) {
    ;['upload', 'load', 'res', 'err'].forEach(function (s) {
      $('.g-step-' + s).style.display = s === step ? 'block' : 'none'
    })
  }
  function open() { ov.classList.add('open'); show('upload') }
  function close() { ov.classList.remove('open') }
  btn.addEventListener('click', open)
  $('.g-x').addEventListener('click', close)
  ov.addEventListener('click', function (e) { if (e.target === ov) close() })
  $('.g-drop').addEventListener('click', function () { if (consentCb && consentCb.checked) fileInput.click() })
  $('.g-again').addEventListener('click', function () { roomDataUrl = null; genBtn.setAttribute('disabled', ''); prev.style.display = 'none'; show('upload') })
  $('.g-retry').addEventListener('click', function () { show('upload') })

  var consentCb = $('.g-consent-cb'), dropEl = $('.g-drop'), consentAt = null
  function updateGen () {
    if (roomDataUrl && consentCb && consentCb.checked) genBtn.removeAttribute('disabled')
    else genBtn.setAttribute('disabled', '')
  }
  // DPDP: consent is an affirmative action taken BEFORE we take the photo, so it gates the
  // picker itself. Unticked by default — never pre-tick this.
  function updateConsent () {
    var ok = !!(consentCb && consentCb.checked)
    if (ok && !consentAt) consentAt = new Date().toISOString()
    dropEl.classList.toggle('g-off', !ok)
    dropEl.setAttribute('aria-disabled', ok ? 'false' : 'true')
    var hint = dropEl.querySelector('span')
    if (hint) hint.textContent = ok ? 'tap to choose or take a photo' : 'tick the box above to continue'
    updateGen()
  }
  if (consentCb) consentCb.addEventListener('change', updateConsent)

  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0]; if (!f) return
    var r = new FileReader()
    r.onload = function () { roomDataUrl = r.result; prev.src = roomDataUrl; prev.style.display = 'block'; updateGen() }
    r.readAsDataURL(f)
  })

  genBtn.addEventListener('click', function () {
    if (!roomDataUrl) return
    show('load')
    var headers = { 'Content-Type': 'application/json' }
    if (cfg.apikey) { headers['apikey'] = cfg.apikey; headers['Authorization'] = 'Bearer ' + cfg.apikey }
    fetch(cfg.endpoint, {
      method: 'POST', headers: headers,
      body: JSON.stringify({
        key: cfg.key, roomImage: roomDataUrl, product: product,
        consent: { version: CONSENT_VERSION, at: consentAt },
        deviceId: deviceId(),
      }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j } }) })
      .then(function (res) {
        if (!res.ok || !res.j.renderDataUrl) throw new Error((res.j && res.j.error) || 'Preview failed — please try again.')
        renderResult(res.j)
      })
      .catch(function (e) { $('.g-err').textContent = e.message || 'Preview failed — please try again.'; show('err') })
  })

  var lastRenderUrl = null
  function renderResult(j) {
    lastRenderUrl = j.renderDataUrl
    $('.g-res img').src = j.renderDataUrl
    var q = j.quote || { items: [], total_inr: product.price_inr }
    var html = ''
    ;(q.items || []).forEach(function (it) {
      html += '<div class="g-row"><span>' + it.name + ' × ' + it.qty + '</span><span>' + INR(it.line_inr) + '</span></div>'
    })
    html += '<div class="g-tot"><span>Total</span><span>' + INR(q.total_inr) + '</span></div>'
    $('.g-quote').innerHTML = html
    var buy = $('.g-buy')
    if (j.buy_link) { buy.href = j.buy_link; buy.style.display = '' } else { buy.style.display = 'none' }
    show('res')
  }

  // WhatsApp: share the actual render image where the browser supports it (mobile), else a text link.
  $('.g-wa').addEventListener('click', function () {
    var msg = 'Check out the ' + product.name + ' in my room — ' + INR(product.price_inr) + (product.buy_link ? ('  ' + product.buy_link) : '')
    function fallback() { window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank') }
    try {
      if (navigator.canShare && lastRenderUrl) {
        fetch(lastRenderUrl).then(function (r) { return r.blob() }).then(function (b) {
          var file = new File([b], 'gruha-room.jpg', { type: b.type || 'image/jpeg' })
          if (navigator.canShare({ files: [file] })) { navigator.share({ files: [file], text: msg }).catch(fallback) }
          else fallback()
        }).catch(fallback)
      } else fallback()
    } catch (e) { fallback() }
  })
})()

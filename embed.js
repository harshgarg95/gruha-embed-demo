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
  // A product is OPTIONAL: on non-product pages the script still loads so the "Your Look" pill
  // follows the shopper around the store. Without a product we mount the pill only.
  var hasProduct = !!(product && product.image_url)
  // Colour / fabric / finish options. Each is just a different reference image, which is what a
  // 2D image model can actually honour — so switching one is a re-render, not a 3D material swap.
  if (!product.variants) {
    try { product.variants = JSON.parse(script.getAttribute('data-variants') || '[]') } catch (e) { product.variants = [] }
  }
  ;(product.variants || []).forEach(function (v) {
    if (v && v.image_url && v.image_url.indexOf('//') === 0) v.image_url = 'https:' + v.image_url
  })

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

  // Currency comes from the store (Shopify passes its ISO code); ₹ is only the fallback.
  var CURRENCY = String(script.getAttribute('data-currency') ||
    (window.GruhaEmbed && window.GruhaEmbed.currency) || 'INR').toUpperCase()
  var LOCALE = script.getAttribute('data-locale') || (CURRENCY === 'INR' ? 'en-IN' : undefined)
  var money = function (n) {
    var v = Number(n || 0)
    try { return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY }).format(v) }
    catch (e) { return CURRENCY + ' ' + v }
  }

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
  .g-addlook{all:unset;cursor:pointer;display:block;text-align:center;font-size:13px;font-weight:600;color:#1f2d2b;\
    border:1px solid #d8dedc;border-radius:10px;padding:9px;margin:0 0 12px}\
  .g-addlook:hover{background:#f3f6f5}\
  .g-rooms{margin-top:12px}\
  .g-rooms-t{font-size:12px;color:#8a938f;margin-bottom:6px}\
  .g-rooms-s{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px}\
  .g-rooms-s img{width:62px;height:48px;object-fit:cover;border-radius:8px;cursor:pointer;\
    border:2px solid transparent;flex:0 0 auto;background:#f1ece4}\
  .g-rooms-s img.sel{border-color:#1f2d2b}\
  .g-saved{margin-top:10px}\
  .g-chip{all:unset;cursor:pointer;display:inline-block;font-size:12px;color:#1f2d2b;background:#f0f3f2;\
    border-radius:999px;padding:6px 11px;margin:0 6px 6px 0}\
  .g-chip:hover{background:#e3e9e7}\
  .g-chip.on{background:#1f2d2b;color:#fff}\
  .g-vars{margin-top:12px}\
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
          '<button class="g-addlook">+ Add to Your Look</button>' +
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
            '<div class="g-rooms" style="display:none"></div>' +
            '<button class="g-cta" disabled>Generate</button>' +
          '</div>' +
          '<div class="g-step g-step-load" style="display:none"><div class="g-spin"><div class="g-dot"></div><div>Staging your room… about 15 seconds</div></div></div>' +
          '<div class="g-step g-step-res" style="display:none">' +
            '<div class="g-res"><img alt="your room with the product"></div>' +
            '<div class="g-quote"></div>' +
            '<div class="g-vars" style="display:none"></div>' +
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
  $('.g-prod .p').textContent = money(product.price_inr)
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
  if (!hasProduct) {
    // Non-product page: this script is here only so the "Your Look" pill follows the shopper.
  } else if (cfg.mount && document.querySelector(cfg.mount)) {
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
  // White-label is a per-brand paid switch, so the widget asks the server (the brand cannot
  // simply strip the badge from the snippet). Fails open = badge stays.
  var brandCfgPromise = null
  function brandConfig () {
    if (!brandCfgPromise) {
      try {
        brandCfgPromise = fetch(cfg.endpoint + '?config=1&key=' + encodeURIComponent(cfg.key))
          .then(function (r) { return r.json() }).catch(function () { return {} })
      } catch (e) { brandCfgPromise = Promise.resolve({}) }
    }
    return brandCfgPromise
  }
  // Hide the badge in whichever shadow root we're given. Fails open: badge stays.
  function applyBrandConfigTo (sel) {
    brandConfig().then(function (c) {
      if (c && c.white_label) { var m = sel('.g-muted'); if (m) m.style.display = 'none' }
    })
  }
  function applyBrandConfig () { applyBrandConfigTo($) }
  function open() { ov.classList.add('open'); show('upload'); applyBrandConfig() }
  function close() { ov.classList.remove('open') }
  btn.addEventListener('click', open)
  $('.g-x').addEventListener('click', close)
  ov.addEventListener('click', function (e) { if (e.target === ov) close() })
  $('.g-drop').addEventListener('click', function () { if (consentCb && consentCb.checked) fileInput.click() })
  $('.g-again').addEventListener('click', function () { roomDataUrl = null; genBtn.setAttribute('disabled', ''); prev.style.display = 'none'; show('upload') })
  $('.g-retry').addEventListener('click', function () { show('upload') })

  var consentCb = $('.g-consent-cb'), dropEl = $('.g-drop'), consentAt = null, roomKeyPicked = null
  function updateGen () {
    if ((roomDataUrl || roomKeyPicked) && consentCb && consentCb.checked) genBtn.removeAttribute('disabled')
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
    // Reusing a stored room is still processing it, so saved rooms appear only after consent.
    if (ok) paintRooms($('.g-rooms'), function (r) {
      roomKeyPicked = r.key; roomDataUrl = null
      prev.src = r.url; prev.style.display = 'block'; updateGen()
    })
    else $('.g-rooms').style.display = 'none'
    updateGen()
  }
  if (consentCb) consentCb.addEventListener('change', updateConsent)

  var photoMeta = null
  // Prepare the upload in the browser: measure quality on the ORIGINAL pixels (faithful, and it
  // keeps heavy decoding off the edge function), then downscale so the payload — and the stored
  // copy — land in the 200-400 KB band. Also cuts what we send to Gemini.
  function prepPhoto (file, cb) {
    var fr = new FileReader()
    fr.onload = function () {
      var img = new Image()
      img.onload = function () {
        var ow = img.naturalWidth, oh = img.naturalHeight
        var m = { w: ow, h: oh, bytes: file.size, brightness: null, sharpness: null }
        try {
          // small grayscale sample of the original
          var S = 192, sc = Math.min(S / ow, S / oh, 1)
          var mw = Math.max(8, Math.round(ow * sc)), mh = Math.max(8, Math.round(oh * sc))
          var mc = document.createElement('canvas'); mc.width = mw; mc.height = mh
          var mx = mc.getContext('2d'); mx.drawImage(img, 0, 0, mw, mh)
          var d = mx.getImageData(0, 0, mw, mh).data
          var g = new Float32Array(mw * mh), sum = 0
          for (var i = 0, q = 0; i < d.length; i += 4, q++) {
            var y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
            g[q] = y; sum += y
          }
          m.brightness = Math.round((sum / g.length) * 10) / 10          // 0..255 mean luma
          var lsum = 0, lsq = 0, n = 0                                    // variance of Laplacian
          for (var yy = 1; yy < mh - 1; yy++) {
            for (var xx = 1; xx < mw - 1; xx++) {
              var k = yy * mw + xx
              var L = 4 * g[k] - g[k - 1] - g[k + 1] - g[k - mw] - g[k + mw]
              lsum += L; lsq += L * L; n++
            }
          }
          if (n) { var mu = lsum / n; m.sharpness = Math.round(((lsq / n) - mu * mu) * 10) / 10 }
        } catch (e) { /* metrics are best-effort; never block the upload */ }
        var MAX = 1440, s2 = Math.min(MAX / ow, MAX / oh, 1)
        var c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(ow * s2)); c.height = Math.max(1, Math.round(oh * s2))
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        var out
        try { out = c.toDataURL('image/jpeg', 0.82) } catch (e) { out = fr.result }
        cb(out, m)
      }
      img.onerror = function () { cb(fr.result, null) }
      img.src = fr.result
    }
    fr.readAsDataURL(file)
  }

  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0]; if (!f) return
    prepPhoto(f, function (dataUrl, meta) {
      roomDataUrl = dataUrl; photoMeta = meta; roomKeyPicked = null   // a fresh upload wins
      prev.src = dataUrl; prev.style.display = 'block'; updateGen()
    })
  })

  // One render call, reused by Generate AND by a variant swap. A variant re-render runs against
  // the SAME room, so the shopper never leaves the view or re-uploads; it is a normal render and
  // meters as one.
  function postRender (prod) {
    show('load')
    var headers = { 'Content-Type': 'application/json' }
    if (cfg.apikey) { headers['apikey'] = cfg.apikey; headers['Authorization'] = 'Bearer ' + cfg.apikey }
    return fetch(cfg.endpoint, {
      method: 'POST', headers: headers,
      body: JSON.stringify({
        key: cfg.key, product: prod,
        roomImage: roomKeyPicked ? null : roomDataUrl,
        roomKey: roomKeyPicked || null,
        consent: { version: CONSENT_VERSION, at: consentAt },
        deviceId: deviceId(),
        photo: roomKeyPicked ? null : photoMeta,   // metrics describe a NEW upload only
        currency: CURRENCY,
      }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j } }) })
      .then(function (res) {
        if (!res.ok || !res.j.renderDataUrl) throw new Error((res.j && res.j.error) || 'Preview failed — please try again.')
        renderResult(res.j, prod)
      })
      .catch(function (e) { $('.g-err').textContent = e.message || 'Preview failed — please try again.'; show('err') })
  }

  genBtn.addEventListener('click', function () {
    if (!roomDataUrl && !roomKeyPicked) return
    roomsCache = null                                  // a new render adds a room; refresh next time
    postRender(product)
  })

  var lastRenderUrl = null
  function renderResult(j, shown) {
    lastRenderUrl = j.renderDataUrl
    $('.g-res img').src = j.renderDataUrl
    var q = j.quote || { items: [], total_inr: product.price_inr }
    var html = ''
    ;(q.items || []).forEach(function (it) {
      html += '<div class="g-row"><span>' + it.name + ' × ' + it.qty + '</span><span>' + money(it.line_inr) + '</span></div>'
    })
    html += '<div class="g-tot"><span>Total</span><span>' + money(q.total_inr) + '</span></div>'
    $('.g-quote').innerHTML = html
    var buy = $('.g-buy')
    if (j.buy_link) { buy.href = j.buy_link; buy.style.display = '' } else { buy.style.display = 'none' }
    paintVariants(shown || product)
    show('res')
  }

  // Colour / finish switcher. Each chip re-renders the same room against that variant's own
  // reference image. We deliberately do NOT offer 360° rotation: that needs a real 3D model,
  // which a 2D image model cannot fake.
  function paintVariants (shown) {
    var box = $('.g-vars'), vs = product.variants || []
    // Only worth showing if the variants actually LOOK different. Many catalogues (Shopify's own
    // sample data included) reuse one image for every variant — chips that all re-render the same
    // reference would just be dead buttons.
    var distinct = {}; vs.forEach(function (v) { if (v && v.image_url) distinct[v.image_url] = 1 })
    if (vs.length < 2 || Object.keys(distinct).length < 2) { box.style.display = 'none'; return }
    var activeImg = (shown && shown.image_url) || product.image_url
    box.style.display = 'block'
    box.innerHTML = '<div class="g-rooms-t">try another finish</div>' + vs.map(function (v, i) {
      return '<button class="g-chip g-var' + (v.image_url === activeImg ? ' on' : '') +
        '" data-i="' + i + '">' + v.label + '</button>' }).join('')
    Array.prototype.forEach.call(box.querySelectorAll('.g-var'), function (b) {
      b.addEventListener('click', function () {
        var v = vs[Number(b.getAttribute('data-i'))]
        if (!v || v.image_url === activeImg) return
        postRender({
          name: product.name,
          price_inr: (v.price_inr != null ? v.price_inr : product.price_inr),
          image_url: v.image_url,
          buy_link: v.buy_link || product.buy_link,
          product_id: product.product_id || null,
          variant: v.label,
        })
      })
    })
  }

  // ---------------------------------------------------------------- Saved rooms
  // A shopper's saved rooms are just the input photos already archived from their past renders,
  // scoped server-side to this brand + this device. Nothing extra is stored, and when the
  // 90-day purge clears those images the list empties by itself.
  var roomsCache = null
  function fetchRooms () {
    if (roomsCache) return roomsCache
    var d = deviceId()
    if (!d) { roomsCache = Promise.resolve([]); return roomsCache }
    try {
      roomsCache = fetch(cfg.endpoint + '?rooms=1&key=' + encodeURIComponent(cfg.key) +
        '&device=' + encodeURIComponent(d))
        .then(function (r) { return r.json() })
        .then(function (j) { return (j && j.rooms) || [] })
        .catch(function () { return [] })
    } catch (e) { roomsCache = Promise.resolve([]) }
    return roomsCache
  }
  function paintRooms (box, onPick) {
    fetchRooms().then(function (rooms) {
      if (!rooms.length) { box.style.display = 'none'; return }
      box.style.display = 'block'
      box.innerHTML = '<div class="g-rooms-t">or reuse a room you used before</div><div class="g-rooms-s">' +
        rooms.map(function (r, i) { return '<img data-i="' + i + '" src="' + r.url + '" alt="saved room">' }).join('') +
        '</div>'
      Array.prototype.forEach.call(box.querySelectorAll('img'), function (im) {
        im.addEventListener('click', function () {
          Array.prototype.forEach.call(box.querySelectorAll('img'), function (x) { x.classList.remove('sel') })
          im.classList.add('sel')
          onPick(rooms[Number(im.getAttribute('data-i'))])
        })
      })
    })
  }

  // ---------------------------------------------------------------- Your Look (multi-product)
  // The look lives in localStorage keyed by brand, so it accumulates as the shopper moves from
  // one product page to the next (the Shopify block only ever knows about the CURRENT product).
  var LOOK_KEY = 'gruha_look_' + cfg.key
  var HARD_CAP = 8                       // never hold more than this
  var CAP_EMPTY = 6, CAP_FURNISHED = 4   // soft caps from our own render testing
  function lookGet () { try { return JSON.parse(localStorage.getItem(LOOK_KEY) || '[]') } catch (e) { return [] } }
  function lookSet (a) {
    try { localStorage.setItem(LOOK_KEY, JSON.stringify(a.slice(0, HARD_CAP))) } catch (e) {}
    if (window.__gruhaLookRefresh) window.__gruhaLookRefresh()
  }
  function lookAdd (p) {
    var a = lookGet()
    if (a.some(function (x) { return x.image_url === p.image_url && x.name === p.name })) return 'dup'
    if (a.length >= HARD_CAP) return 'full'
    a.push({ name: p.name, price_inr: p.price_inr, image_url: p.image_url, buy_link: p.buy_link,
             product_id: p.product_id || null, variant: p.variant || null })
    lookSet(a); return 'ok'
  }

  if (hasProduct) {
    var addBtn = $('.g-addlook')
    addBtn.addEventListener('click', function () {
      var r = lookAdd(product)
      addBtn.textContent = r === 'ok' ? '✓ Added to Your Look'
        : r === 'dup' ? 'Already in Your Look'
        : 'Your Look is full (' + HARD_CAP + ')'
      setTimeout(function () { addBtn.textContent = '+ Add to Your Look' }, 1800)
    })
  }

  // One pill + drawer per page, no matter how many product scripts the page carries.
  if (!window.__gruhaLookMounted) {
    window.__gruhaLookMounted = true
    mountLook()
  }

  function mountLook () {
    var lh = document.createElement('div')
    lh.setAttribute('data-gruha-look', '')
    lh.style.setProperty('display', 'block', 'important')   // themes hide :empty divs (Dawn)
    document.body.appendChild(lh)
    var lr = lh.attachShadow({ mode: 'open' })
    lr.innerHTML =
      '<style>' + CSS +
      '.l-pill{position:fixed;left:18px;bottom:18px;z-index:2147483000;all:unset;cursor:pointer;' +
        'display:none;align-items:center;gap:8px;background:#b08642;color:#fff;font-weight:700;font-size:14px;' +
        'line-height:1;padding:12px 17px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.22);' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
      '.l-row{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f0eee9}' +
      '.l-row img{width:42px;height:42px;object-fit:cover;border-radius:8px;background:#f3f3f1}' +
      '.l-row .t{flex:1;min-width:0}.l-row .t b{display:block;font-size:13px;font-weight:600;' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.l-row .t span{font-size:12px;color:#8a938f}' +
      '.l-x{all:unset;cursor:pointer;color:#b4231b;font-size:17px;padding:0 4px}' +
      '.l-seg{display:flex;gap:6px;margin:12px 0}' +
      '.l-seg button{all:unset;cursor:pointer;flex:1;text-align:center;font-size:12px;font-weight:600;' +
        'padding:8px;border-radius:9px;border:1px solid #d8dedc;color:#53605c}' +
      '.l-seg button[aria-pressed="true"]{background:#1f2d2b;color:#fff;border-color:#1f2d2b}' +
      '.l-note{font-size:12px;color:#8a938f;margin-top:8px;line-height:1.5}' +
      '.l-warn{font-size:12px;color:#8a6d1f;background:#fdf6e6;border-radius:9px;padding:9px 11px;margin-top:10px}' +
      '</style>' +
      '<button class="l-pill"><span>🛋️</span><span class="l-pill-t">Your Look</span></button>' +
      '<div class="g-ov l-ov"><div class="g-card"><div class="g-hd">' +
        '<h3>Your Look</h3><button class="g-x l-close" aria-label="Close">×</button></div>' +
        '<div class="g-bd">' +
          '<div class="l-items"></div>' +
          '<div class="g-saved l-saved"></div>' +
          '<div class="l-seg"><button class="l-furn" aria-pressed="true">My room has furniture</button>' +
            '<button class="l-empty" aria-pressed="false">My room is empty</button></div>' +
          '<div class="l-warn" style="display:none"></div>' +
          '<button class="g-addlook l-more">+ Add another product</button>' +
          '<div class="g-step l-step-upload">' +
            '<label class="g-consent"><input type="checkbox" class="l-consent-cb">' +
              '<span>I agree to Gruha processing and storing my photo to create this preview. ' +
              'It\'s kept private, used only to generate and show your render, and you can ask for it ' +
              'to be deleted. <a href="' + PRIVACY_URL + '" target="_blank" rel="noopener">Privacy note</a>' +
              '</span></label>' +
            '<div class="g-drop l-drop g-off" aria-disabled="true">📷 Upload a photo of your room<br>' +
              '<span style="font-size:12px">tick the box above to continue</span></div>' +
            '<input class="l-file" type="file" accept="image/*" capture="environment" style="display:none">' +
            '<img class="g-prev l-prev" alt="your room">' +
            '<div class="g-rooms l-rooms" style="display:none"></div>' +
            '<button class="g-cta l-go" disabled>See my look</button>' +
          '</div>' +
          '<div class="g-step l-step-load" style="display:none"><div class="g-spin"><div class="g-dot"></div>' +
            '<div class="l-prog">Staging your room…</div></div></div>' +
          '<div class="g-step l-step-res" style="display:none">' +
            '<div class="g-res"><img alt="your look"></div><div class="g-quote l-quote"></div>' +
            '<div class="g-actions"><button class="g-wa l-wa">Share on WhatsApp</button></div>' +
            '<button class="g-link l-again">↻ Try another room</button></div>' +
          '<div class="g-step l-step-err" style="display:none"><div class="g-err l-err"></div>' +
            '<button class="g-cta l-retry">Try again</button></div>' +
          '<div class="g-muted l-muted">Powered by <a href="https://gruha-decor-studio.vercel.app" target="_blank" rel="noopener">Gruha</a></div>' +
        '</div></div></div>'

    var L = function (s) { return lr.querySelector(s) }
    var pill = L('.l-pill'), lov = L('.l-ov'), lfile = L('.l-file'), lprev = L('.l-prev')
    var lgo = L('.l-go'), lcb = L('.l-consent-cb'), ldrop = L('.l-drop')
    var roomType = 'furnished', lroom = null, lmeta = null, lconsentAt = null, lastLook = null
    var lroomKey = null
    // Saved looks are product references only — no images — so they carry no retention burden.
    var SAVED_KEY = 'gruha_looks_saved_' + cfg.key
    function savedGet () { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch (e) { return [] } }
    function savedSet (a) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(a.slice(0, 10))) } catch (e) {} }
    function renderSaved () {
      var box = L('.l-saved'), saved = savedGet(), cur = lookGet()
      box.innerHTML =
        (cur.length ? '<button class="g-chip l-save">💾 Save this look</button>' : '') +
        saved.map(function (x, i) {
          return '<button class="g-chip l-open" data-i="' + i + '">' + x.name + '</button>' }).join('')
      var sb = L('.l-save')
      if (sb) sb.addEventListener('click', function () {
        var a = savedGet()
        a.unshift({ name: cur.length + ' items · ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
                    items: cur, at: new Date().toISOString() })
        savedSet(a); renderSaved()
        sb.textContent = '✓ Saved'
      })
      Array.prototype.forEach.call(lr.querySelectorAll('.l-open'), function (b) {
        b.addEventListener('click', function () {
          var x = savedGet()[Number(b.getAttribute('data-i'))]
          if (x && x.items) { lookSet(x.items); refresh() }
        })
      })
    }

    function cap () { return roomType === 'empty' ? CAP_EMPTY : CAP_FURNISHED }
    function lshow (st) {
      ;['upload', 'load', 'res', 'err'].forEach(function (x) {
        L('.l-step-' + x).style.display = x === st ? 'block' : 'none' })
    }
    function refresh () {
      var a = lookGet()
      pill.style.display = a.length ? 'inline-flex' : 'none'
      L('.l-pill-t').textContent = 'Your Look (' + a.length + ')'
      L('.l-items').innerHTML = a.length ? a.map(function (it, i) {
        return '<div class="l-row"><img src="' + (it.image_url || '') + '" alt="">' +
          '<div class="t"><b>' + (it.name || '') + '</b><span>' + money(it.price_inr) + '</span></div>' +
          '<button class="l-x" data-i="' + i + '" aria-label="Remove">×</button></div>' }).join('')
        : '<p class="l-note">Nothing here yet. Open a product and tap “Add to Your Look”.</p>'
      Array.prototype.forEach.call(lr.querySelectorAll('.l-x'), function (b) {
        b.addEventListener('click', function () {
          var arr = lookGet(); arr.splice(Number(b.getAttribute('data-i')), 1); lookSet(arr)
        })
      })
      var w = L('.l-warn')
      if (a.length > cap()) {
        w.style.display = 'block'
        w.textContent = (roomType === 'empty' ? 'An empty' : 'A furnished') + ' room holds about ' +
          cap() + ' pieces convincingly. We\'ll show your top ' + cap() + ' of ' + a.length + '.'
      } else w.style.display = 'none'
      lgo.textContent = 'See my look' + (a.length ? ' (' + Math.min(a.length, cap()) + ')' : '')
    }
    window.__gruhaLookRefresh = refresh

    function updL () {
      if ((lroom || lroomKey) && lcb.checked) lgo.removeAttribute('disabled'); else lgo.setAttribute('disabled', '')
    }
    lcb.addEventListener('change', function () {
      var ok = lcb.checked
      if (ok && !lconsentAt) lconsentAt = new Date().toISOString()
      ldrop.classList.toggle('g-off', !ok)
      ldrop.setAttribute('aria-disabled', ok ? 'false' : 'true')
      var h = ldrop.querySelector('span')
      if (h) h.textContent = ok ? 'tap to choose or take a photo' : 'tick the box above to continue'
      if (ok) paintRooms(L('.l-rooms'), function (r) {
        lroomKey = r.key; lroom = null
        lprev.src = r.url; lprev.style.display = 'block'; updL()
      })
      else L('.l-rooms').style.display = 'none'
      updL()
    })
    ldrop.addEventListener('click', function () { if (lcb.checked) lfile.click() })
    lfile.addEventListener('change', function () {
      var f = lfile.files && lfile.files[0]; if (!f) return
      prepPhoto(f, function (d, m) { lroom = d; lmeta = m; lroomKey = null; lprev.src = d; lprev.style.display = 'block'; updL() })
    })
    pill.addEventListener('click', function () {
      roomsCache = null; refresh(); renderSaved(); lov.classList.add('open'); lshow('upload'); applyBrandConfigTo(L)
    })
    L('.l-close').addEventListener('click', function () { lov.classList.remove('open') })
    lov.addEventListener('click', function (e) { if (e.target === lov) lov.classList.remove('open') })
    L('.l-more').addEventListener('click', function () { lov.classList.remove('open') })
    L('.l-retry').addEventListener('click', function () { lshow('upload') })
    L('.l-again').addEventListener('click', function () { lroom = null; lroomKey = null; lprev.style.display = 'none'; updL(); lshow('upload') })
    ;[['furn', 'furnished'], ['empty', 'empty']].forEach(function (pair) {
      L('.l-' + pair[0]).addEventListener('click', function () {
        roomType = pair[1]
        L('.l-furn').setAttribute('aria-pressed', String(roomType === 'furnished'))
        L('.l-empty').setAttribute('aria-pressed', String(roomType === 'empty'))
        refresh()
      })
    })

    lgo.addEventListener('click', function () {
      var all = lookGet(), items = all.slice(0, cap())
      if (!items.length || (!lroom && !lroomKey)) return
      lshow('load')
      // SEQUENTIAL: one product per pass, each pass feeding the previous render forward. This is
      // what our testing showed keeps the room locked and each product recognisable; a single
      // multi-reference call drifts the camera and oversizes large items. Each pass is a real
      // render, so a look of N items costs N credits — that is deliberate and documented.
      var lookId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : null
      var current = lroom, i = 0
      function step () {
        if (i >= items.length) { finish(current, items, all.length); return }
        var it = items[i]
        L('.l-prog').textContent = 'Placing ' + (i + 1) + ' of ' + items.length + ' — ' + (it.name || 'item')
        fetch(cfg.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: cfg.key, product: it, currency: CURRENCY,
            roomImage: (i === 0 && lroomKey) ? null : current,   // pass 1 may be a SAVED room
            roomKey: (i === 0 && lroomKey) ? lroomKey : null,
            consent: { version: CONSENT_VERSION, at: lconsentAt }, deviceId: deviceId(),
            photo: (i === 0 && !lroomKey) ? lmeta : null,        // metrics describe a NEW upload only
            look: lookId ? { id: lookId, index: i + 1, size: items.length } : null,
          }),
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j } }) })
          .then(function (res) {
            if (!res.ok || !res.j.renderDataUrl) throw new Error((res.j && res.j.error) || 'Preview failed.')
            current = res.j.renderDataUrl; i++; step()
          })
          .catch(function (e) { L('.l-err').textContent = e.message || 'Preview failed.'; lshow('err') })
      }
      step()
    })

    function finish (img, items, total) {
      lastLook = img
      L('.l-step-res').querySelector('img').src = img
      var sum = 0
      var rows = items.map(function (it) {
        sum += Number(it.price_inr) || 0
        var nm = it.buy_link ? '<a href="' + it.buy_link + '" target="_blank" rel="noopener">' + it.name + '</a>' : it.name
        return '<div class="g-row"><span>' + nm + ' × 1</span><span>' + money(it.price_inr) + '</span></div>'
      }).join('')
      if (total > items.length) {
        rows += '<div class="g-row"><span style="color:#8a6d1f">Showing your top ' + items.length +
          ' of ' + total + '</span><span></span></div>'
      }
      L('.l-quote').innerHTML = rows + '<div class="g-tot"><span>Total</span><span>' + money(sum) + '</span></div>'
      lshow('res')
    }

    L('.l-wa').addEventListener('click', function () {
      var items = lookGet().slice(0, cap())
      var msg = 'My look: ' + items.map(function (i) { return i.name }).join(', ')
      function fb () { window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank') }
      try {
        if (navigator.canShare && lastLook) {
          fetch(lastLook).then(function (r) { return r.blob() }).then(function (b) {
            var f = new File([b], 'gruha-look.jpg', { type: b.type || 'image/jpeg' })
            if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: msg }).catch(fb); else fb()
          }).catch(fb)
        } else fb()
      } catch (e) { fb() }
    })

    refresh(); renderSaved()
  }

  // WhatsApp: share the actual render image where the browser supports it (mobile), else a text link.
  $('.g-wa').addEventListener('click', function () {
    var msg = 'Check out the ' + product.name + ' in my room — ' + money(product.price_inr) + (product.buy_link ? ('  ' + product.buy_link) : '')
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

/* Gruha walkthrough (dummy). Runs the REAL widget, but nothing reaches our server:
   the page points the widget at a non-existent address and answers every call here,
   with a saved example. No render happens and nothing can be charged. */
(function () {
  'use strict'
  window.__GRUHA_TEST__ = true        // exposes the widget's own setPhoto hook
  window.__gruhaLookMounted = true    // no "Your Look" pill here: it would need real multi-product renders
  var RENDER_MS = 4000
  var me = document.currentScript
  var price = Number(me.getAttribute('data-price')), name = me.getAttribute('data-name'), handle = me.getAttribute('data-handle')
  var json = function (o) { return new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }) }
  var realFetch = window.fetch.bind(window)
  window.fetch = function (url, opts) {
    var u = String((url && url.url) || url)
    if (u.indexOf('data:') === 0 || u.indexOf('blob:') === 0) return realFetch(url, opts)
    if (u.indexOf('?config=1') > -1) return Promise.resolve(json({}))
    if (u.indexOf('?rooms=1') > -1) return Promise.resolve(json({ rooms: [] }))
    if (u.indexOf('walkthrough.invalid') > -1 && opts && opts.method === 'POST' && u.indexOf('?') === -1) {
      return new Promise(function (ok) {
        setTimeout(function () {
          ok(json({ renderDataUrl: window.WT.after, buy_link: '#buy',
            quote: { items: [{ name: name, qty: 1, line_inr: price }], total_inr: price } }))
        }, RENDER_MS)
      })
    }
    return Promise.resolve(json({ ok: true }))   // track beacons, cart tagging: answered locally
  }

  function toast (t) {
    var e = document.getElementById('wt-toast')
    e.textContent = t; e.classList.add('on')
    clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove('on') }, 3200)
  }
  window.wtToast = toast
  if (navigator.canShare) navigator.canShare = function () { return false }
  window.open = function (u) {
    toast(String(u).indexOf('wa.me') > -1 ? 'On a live store, this shares the preview on WhatsApp.' : 'On a live store, this opens the product.')
    return null
  }

  function host () {
    var all = document.querySelectorAll('*')
    for (var i = 0; i < all.length; i++) if (all[i].__gruha) return all[i]
    return null
  }
  function fileFrom (dataUrl) {
    var p = dataUrl.split(','), b = atob(p[1]), a = new Uint8Array(b.length)
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i)
    return new File([a], 'sample-room.jpg', { type: 'image/jpeg' })
  }
  // One click on "Upload a photo" loads the sample room instead of opening the file picker.
  var realClick = HTMLInputElement.prototype.click
  HTMLInputElement.prototype.click = function () {
    if (this.type === 'file' && window.WT && host()) { host().__gruha.setPhoto(fileFrom(window.WT.before)); skipWarning(); showGenerate(); return }
    return realClick.call(this)
  }
  // The sample photos are known-good, so the live photo-quality warning is not shown for them.
  function skipWarning () {
    var n = 0, r = host().__gruha.root, iv = setInterval(function () {
      var a = r.querySelector('.g-anyway')
      if (a) { var box = a.parentElement; a.click(); box.style.display = 'none'; clearInterval(iv) }
      else if (++n > 40) clearInterval(iv)
    }, 50)
  }
  // Bring the Generate button into view once the sample room has loaded.
  function showGenerate () {
    var n = 0, r = host().__gruha.root, iv = setInterval(function () {
      var b = r.querySelector('.g-cta')
      if (b && !b.disabled) { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); clearInterval(iv) }
      else if (++n > 60) clearInterval(iv)
    }, 50)
  }
  var wait = setInterval(function () {
    var h = host()
    if (!h) return
    var root = h.__gruha.root, cb = root.querySelector('.g-consent-cb')
    if (!cb) return
    clearInterval(wait)
    var st = document.createElement('style')
    st.textContent = '.g-addlook,.g-phone{display:none!important}'
    root.appendChild(st)
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }))
    var hint = root.querySelector('.g-drop span')
    if (hint) hint.textContent = 'tap to use the sample room'
    root.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.g-buy')) { e.preventDefault(); e.stopPropagation(); toast('On a live store, this opens the product to buy.') }
    }, true)
  }, 80)
})()

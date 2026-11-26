#!/usr/bin/env python3
"""Builds /walkthrough: a no-backend click-through of the demo store using saved examples."""
import base64, html, io, json, os, re
from PIL import Image
R = os.path.expanduser('~/Desktop/Gruha/renders/')
S_ = R + 'qa-20261013/seating/'; Q = R + 'qa-20261012/quality/'; C = R + 'qa-20261013/categories/'; B = R + '_review/2026-10-28-readiness-bar/'
M = 'media/renders/'
EMPTY = Q + '_inputs/02_empty_living_room__1440q82.jpg'; LIVING = Q + '_inputs/livingroom_01_contemporary-warm__1440q82.jpg'; STUDY = Q + '_inputs/study_01_home-office__1440q82.jpg'
# Every pair below was checked by eye against the product's own photo (23 Nov 2026).
# Left out: Provence, Duck (no saved render in our own rooms); Fou (blocks the TV unit);
# Rug (lands on top of the existing rug); Cromwell (cut off at the frame edge).
ITEMS = [
 ('cavallo-3-seater-sofa', EMPTY, S_ + 'empty__sofa_cavallo.jpg'),
 ('arden-accent-chair', LIVING, S_ + 'furnished__chair_arden.jpg'),
 ('industrial-gare-clock-center-table', LIVING, Q + 'furnished__centre.jpg'),
 ('blue-chinoiserie-scalloped-fruit-bowl', M + 'g_bowl_before.jpg', M + 'g_bowl_after.jpg'),
 ('acacia-distressed-finish-console', M + 'g_console_before.jpg', M + 'g_console_after.jpg'),
 ('yorkshire-victorian-ornamental-side-table', M + 'g_table_before.jpg', M + 'g_table_after.jpg'),
 ('fluted-classic-table-lamp', LIVING, Q + 'furnished__lamp.jpg'),
 ('sky-blossom-garden-stool', STUDY, C + 'cluttered__gardenstool.jpg'),
 ('royal-orbit-serving-bar-cart', B + 'r5_before.jpg', B + 'r5_after.jpg'),
 ('the-versailles-distressed-baroque-floor-mirror', M + 'g_mirror_before.jpg', M + 'g_mirror_after.jpg'),
 ('equine-framed-art', STUDY, C + 'cluttered__wallart.jpg'),
]
def uri(p):
    im = Image.open(p).convert('RGB'); im.thumbnail((1200, 1200)); b = io.BytesIO(); im.save(b, 'JPEG', quality=84)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
EXTRA = '''<style>.wt{background:#241f1b;color:#fff;text-align:center;font-size:12.5px;padding:7px 12px}
#wt-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);background:#241f1b;color:#fff;padding:11px 18px;border-radius:10px;font-size:14px;opacity:0;transition:.25s;pointer-events:none;z-index:2147483647}
#wt-toast.on{opacity:1;transform:translate(-50%,0)}</style>'''
BANNER = ''
prods = {x['handle']: x for x in json.load(open('demo/products.json'))}
cards = ''
for h, b, a in ITEMS:
    open(f'walkthrough/assets/{h}.js', 'w').write('window.WT=' + json.dumps({'before': uri(b), 'after': uri(a)}))
    t = open(f'demo/p/{h}.html').read(); x = prods[h]
    t = t.replace('</head>', EXTRA + '</head>', 1).replace('<body>', '<body>' + BANNER, 1)
    t = re.sub(r'<title>.*?</title>', f'<title>{html.escape(x["name"])} (walkthrough)</title>', t)
    t = t.replace('href="/demo/"', 'href="../index.html"')
    t = re.sub(r'<button class="buy"[^>]*>', '<button class="buy" onclick="wtToast(\'On a live store, this adds it to the cart.\')">', t)
    t = re.sub(r'<p class="note">.*?</p>', '<p class="note">Demonstration store.</p>', t, flags=re.S)
    t = t.replace('back to all 16 pieces', 'back to all pieces')
    t = t.replace('src="/v15/embed.js"', 'src="../../v15/embed.js"')
    t = t.replace('data-gruha-key="gk_demo_dkart_2f9a4e6b1c83"', 'data-gruha-key="gk_walkthrough_dummy"')
    t = re.sub(r'data-endpoint="[^"]+"', 'data-endpoint="https://walkthrough.invalid/embed-render"', t)
    t = re.sub(r'data-product-buylink="[^"]*"', 'data-product-buylink="#buy"', t)
    t = t.replace(' async></script>', '></script>')
    pre = (f'<div id="wt-toast"></div><script src="../assets/{h}.js"></script>'
           f'<script src="../walkthrough.js" data-handle="{h}" data-name="{html.escape(x["name"])}" data-price="{x["price_inr"]}"></script>\n')
    t = t.replace('<script src="../../v15/embed.js"', pre + '<script src="../../v15/embed.js"', 1)
    open(f'walkthrough/p/{h}.html', 'w').write(t)
    m = re.search(r'<a class="card" href="/demo/p/' + h + r'">.*?</a>', open('demo/index.html').read(), re.S)
    cards += m.group(0).replace(f'/demo/p/{h}', f'p/{h}.html') + '\n'
i = open('demo/index.html').read()
i = re.sub(r'(<div class="grid">).*?(</div>\s*<div class="foot">)', lambda m: m.group(1) + '\n' + cards + m.group(2), i, count=1, flags=re.S)
i = i.replace('</head>', EXTRA + '</head>', 1).replace('<body>', '<body>' + BANNER, 1).replace('href="/demo/"', 'href="index.html"')
i = i.replace(' loading="lazy"', '')
i = re.sub(r'<title>.*?</title>', '<title>The Demo Store (walkthrough)</title>', i)
i = re.sub(r'<p>Open any piece.*?</p>', '<p>Pick a piece, add a room photo, and see it staged, with the price and a link to buy.</p>', i, flags=re.S)
if 'noindex' not in i: i = i.replace('<head>', '<head><meta name="robots" content="noindex">', 1)
i = re.sub(r'<script src="/v15/embed\.js".*?</script>', '', i, flags=re.S)
open('walkthrough/index.html', 'w').write(i)
print('built', len(ITEMS))

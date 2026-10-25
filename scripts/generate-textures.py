#!/usr/bin/env python3
"""Génère les textures d'Envies (aucune IA : bruit, flous et dégradés procéduraux).

Usage : python3 scripts/generate-textures.py public/textures
Dépendances : pip install numpy pillow

Produit :
  bokeh-hero.jpg / bokeh-mobile.jpg   ambiance « feuillage » (flou de feuillage à contre-jour)
  ambre-hero.jpg / ambre-mobile.jpg   ambiance « ambre » (même générateur, palette d'intérieur chaud)
  sky-golden.jpg / sky-golden-mobile.jpg  ambiance « ciel doré »
  grain-fine.png                      grain fin en surimpression (tuile 200 px, alpha 20/255)
  grain.png                           grain plus marqué (mix-blend-mode: overlay sur les images)
  photo-backdrop.jpg                  fond « studio » derrière les photos d'articles
Les fichiers livrés dans public/textures ont été produits avec ces mêmes graines.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import random, sys, os

OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/textures'
os.makedirs(OUT, exist_ok=True)


def hex2rgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], dtype=np.float32)

def fbm(h, w, beta, seed):
    r = np.random.default_rng(seed)
    F = np.fft.fft2(r.standard_normal((h, w)))
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx**2 + fy**2); f[0, 0] = 1
    F = F / (f ** beta); F[0, 0] = 0
    out = np.real(np.fft.ifft2(F))
    return (out - out.mean()) / (out.std() + 1e-9)

def save_jpg(arr, name, q=84):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=q, optimize=True, progressive=True)

def leaf_layer(W, H, n, size, cols, alpha, blur, seed, bias=None):
    random.seed(seed)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for _ in range(n):
        lw = int(random.uniform(*size) * W); lh = int(lw * random.uniform(0.28, 0.42))
        if bias and random.random() < bias[2]:
            x = int(random.gauss(bias[0] * W, W * 0.2)); y = int(random.gauss(bias[1] * H, H * 0.25))
        else:
            x = random.randint(-lw // 3, W + lw // 3); y = random.randint(-lh, H + lh)
        tile = Image.new('RGBA', (lw + 4, lw + 4), (0, 0, 0, 0)); td = ImageDraw.Draw(tile)
        c = hex2rgb(random.choice(cols)).astype(int)
        cy = (lw + 4) // 2
        td.ellipse([2, cy - lh // 2, lw + 2, cy + lh // 2], fill=(c[0], c[1], c[2], int(alpha * random.uniform(0.7, 1.0) * 255)))
        tile = tile.rotate(random.uniform(0, 180), expand=False)
        layer.alpha_composite(tile, (x - (lw + 4) // 2, y - (lw + 4) // 2)) if 0 <= x - (lw + 4) // 2 and 0 <= y - (lw + 4) // 2 and x + (lw + 4) // 2 < W and y + (lw + 4) // 2 < H else layer.paste(tile, (x - (lw + 4) // 2, y - (lw + 4) // 2), tile)
    return layer.filter(ImageFilter.GaussianBlur(blur))

def foliage(W, H, name, seed, sun=(0.74, 0.22)):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    deep = hex2rgb('#1B210C'); olive = hex2rgb('#4C5626')
    t = np.clip((xx / W) * 0.5 + (1 - yy / H) * 0.2 + 0.2, 0, 1)[:, :, None]
    img = Image.fromarray((deep * (1 - t) + olive * t).astype(np.uint8)).convert('RGBA')
    s = min(W, H)
    # far: big soft masses
    img = Image.alpha_composite(img, leaf_layer(W, H, 26, (0.25, 0.55), ['#2A3213', '#3B4519', '#57612C', '#4A5A22', '#6B6A2A'], 0.75, s * 0.09, seed))
    # sunlight through leaves
    arr = np.asarray(img).astype(np.float32)[:, :, :3]
    g1 = np.exp(-(((xx - sun[0] * W) / (W * 0.3)) ** 2 + ((yy - sun[1] * H) / (H * 0.42)) ** 2))
    arr += g1[:, :, None] * hex2rgb('#D99A3E') * 0.55
    g2 = np.exp(-(((xx - 0.22 * W) / (W * 0.22)) ** 2 + ((yy - 0.75 * H) / (H * 0.3)) ** 2))
    arr += g2[:, :, None] * hex2rgb('#A76A19') * 0.35
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert('RGBA')
    # mid leaves, moderately blurred, some lit
    img = Image.alpha_composite(img, leaf_layer(W, H, 40, (0.08, 0.2), ['#3E4A1A', '#57612C', '#6E7A36', '#7F8A3E', '#8C7A2E'], 0.8, s * 0.028, seed + 1))
    img = Image.alpha_composite(img, leaf_layer(W, H, 16, (0.05, 0.12), ['#B9A458', '#C9B86A', '#D9A441', '#A8A04E'], 0.55, s * 0.02, seed + 2, bias=(sun[0], sun[1], 0.8)))
    # a few soft specular bokeh
    random.seed(seed + 3)
    spec = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(spec)
    for _ in range(9):
        r = int(random.uniform(0.02, 0.045) * s)
        x = int(random.gauss(sun[0] * W, W * 0.12)); y = int(random.gauss(sun[1] * H, H * 0.15))
        c = hex2rgb(random.choice(['#F3DDA6', '#EBCB86', '#DCE0A8'])).astype(int)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(c[0], c[1], c[2], random.randint(35, 80)))
    img = Image.alpha_composite(img, spec.filter(ImageFilter.GaussianBlur(s * 0.006)))
    # near foreground leaves: dark, huge blur
    img = Image.alpha_composite(img, leaf_layer(W, H, 6, (0.3, 0.5), ['#10150A', '#151B09', '#1B230C'], 0.92, s * 0.05, seed + 4, bias=(0.05, 0.95, 0.5)))
    arr = np.asarray(img).astype(np.float32)[:, :, :3]
    vig = 1 - 0.42 * (((xx - W / 2) / (W * 0.6)) ** 2 + ((yy - H / 2) / (H * 0.68)) ** 2)
    arr *= np.clip(vig, 0.5, 1)[:, :, None]
    arr += np.random.default_rng(seed + 5).normal(0, 6, (H, W))[:, :, None]
    save_jpg(arr, name, 82)



# ---------- ciel doré ----------
from PIL import Image, ImageDraw, ImageFilter
h2r = hex2rgb

def sky(W, H, name, seed):
    random.seed(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    stops = [(0.0, '#8F9A6C'), (0.38, '#C7B37C'), (0.7, '#E2B978'), (1.0, '#EDCFA0')]
    t = yy / H
    arr = np.zeros((H, W, 3), np.float32)
    for (a, ca), (b, cb) in zip(stops[:-1], stops[1:]):
        m = (t >= a) & (t <= b)
        k = ((t - a) / (b - a))[..., None]
        arr = np.where(m[..., None], h2r(ca) * (1 - k) + h2r(cb) * k, arr)
    sun = np.exp(-(((xx - W * 0.68) / (W * 0.28)) ** 2 + ((yy - H * 0.78) / (H * 0.5)) ** 2))[..., None]
    arr = arr + sun * (h2r('#F7E2B4') - arr) * 0.55
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert('RGBA')
    # soft clouds: long horizontal cream masses, lit from below by the sun
    for layer, (n, blur, alpha, col) in enumerate([(9, 70, 0.5, '#F3E4C4'), (14, 34, 0.42, '#F5E8CF'), (10, 18, 0.32, '#FBF0DC')]):
        c = h2r(col).astype(int)
        cl = Image.new('RGBA', (W, H), (c[0], c[1], c[2], 0)); d = ImageDraw.Draw(cl)
        for _ in range(n):
            cw = random.uniform(0.2, 0.55) * W / (1 + layer * 0.5); ch = cw * random.uniform(0.1, 0.18)
            x = random.uniform(-0.1, 1.1) * W; y = random.uniform(0.1, 0.72) * H
            for j in range(12):
                ox = random.gauss(0, 0.28) * cw; oy = random.gauss(0, 0.25) * ch
                r = random.uniform(0.15, 0.35) * cw
                d.ellipse([x + ox - r, y + oy - r * 0.45, x + ox + r, y + oy + r * 0.45], fill=(c[0], c[1], c[2], int(255 * alpha * random.uniform(0.5, 1))))
        img = Image.alpha_composite(img, cl.filter(ImageFilter.GaussianBlur(blur * W / 2400)))
    arr = np.asarray(img).astype(np.float32)[:, :, :3]
    arr += np.random.default_rng(seed).normal(0, 4.5, (H, W))[:, :, None]
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=84, optimize=True, progressive=True)

def fine_grain(N, name):
    r = np.random.default_rng(12)
    g = r.normal(128, 55, (N, N)).clip(0, 255).astype(np.uint8)
    a = np.full((N, N), 20, np.uint8)
    Image.fromarray(np.dstack([g, g, g, a]), 'RGBA').save(os.path.join(OUT, name), optimize=True)


# ---------- grain + fond studio ----------
def grain_png(N, name):
    r = np.random.default_rng(11)
    g = r.normal(128, 40, (N, N)).clip(0, 255).astype(np.uint8)
    a = np.full((N, N), 34, np.uint8)
    Image.fromarray(np.dstack([g, g, g, a]), 'RGBA').save(os.path.join(OUT, name), optimize=True)

# ---------- 5. Product photo backdrop (studio sweep) ----------
def backdrop(W, H, name, seed=5):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    top = hex2rgb('#F4EEE2'); bot = hex2rgb('#E2D6BF')
    t = (yy / H)[:, :, None] ** 1.4
    arr = top * (1 - t) + bot * t
    light = np.exp(-(((xx - W * 0.35) / (W * 0.7)) ** 2 + ((yy - H * 0.2) / (H * 0.6)) ** 2))[:, :, None]
    arr = arr + 10 * light
    sh = np.exp(-(((xx - W * 0.5) / (W * 0.28)) ** 2 + ((yy - H * 0.82) / (H * 0.05)) ** 2))[:, :, None]
    arr = arr - 26 * sh
    arr += np.random.default_rng(seed).normal(0, 2.2, (H, W))[:, :, None]
    save_jpg(arr, name, 86)



def ambre_variant():
    """Re-palette du générateur de feuillage pour l'ambiance ambre."""
    import inspect
    src = inspect.getsource(leaf_layer) + inspect.getsource(foliage)
    rep = {"'#1B210C'": "'#1E130A'", "'#4C5626'": "'#5C3A1F'",
           "['#2A3213', '#3B4519', '#57612C', '#4A5A22', '#6B6A2A']": "['#2E1D0F', '#4A2E17', '#6B4424', '#7A4E22', '#5A2A18']",
           "['#3E4A1A', '#57612C', '#6E7A36', '#7F8A3E', '#8C7A2E']": "['#6B4424', '#8E5A26', '#A76A19', '#7A3A20', '#57612C']",
           "['#B9A458', '#C9B86A', '#D9A441', '#A8A04E']": "['#E8B05A', '#F0C77A', '#D9A441', '#E9A060']",
           "'#D99A3E'": "'#F0B050'", "['#10150A', '#151B09', '#1B230C']": "['#140C06', '#1A1009', '#21140A']"}
    for k, v in rep.items():
        src = src.replace(k, v)
    ns = dict(globals())
    exec(src, ns)
    ns['foliage'](2400, 1350, 'ambre-hero.jpg', 303, sun=(0.3, 0.3))
    ns['foliage'](900, 1600, 'ambre-mobile.jpg', 404, sun=(0.35, 0.2))


if __name__ == '__main__':
    foliage(2400, 1350, 'bokeh-hero.jpg', 101)
    foliage(900, 1600, 'bokeh-mobile.jpg', 202, sun=(0.7, 0.18))
    ambre_variant()
    sky(2400, 1100, 'sky-golden.jpg', 5)
    sky(900, 1000, 'sky-golden-mobile.jpg', 8)
    fine_grain(200, 'grain-fine.png')
    grain_png(256, 'grain.png')
    backdrop(800, 1000, 'photo-backdrop.jpg')
    print('textures écrites dans', OUT)

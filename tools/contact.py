"""試験の 写真を まとめて 見る ための 一覧画像。python tools/contact.py フォルダ [名前の一部 ...]"""
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
d = sys.argv[1]; keys = sys.argv[2:]
fs = [f for f in sorted(glob.glob(os.path.join(d, '*.png'))) if not keys or any(k in os.path.basename(f) for k in keys)]
W, MAXH, COLS = 330, 900, 4
font = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 16)
tiles = []
for f in fs:
    im = Image.open(f).convert('RGB'); im.thumbnail((W, 10000))
    if im.height > MAXH: im = im.crop((0, 0, W, MAXH))
    t = Image.new('RGB', (W, im.height + 24), 'white'); t.paste(im, (0, 24))
    ImageDraw.Draw(t).text((4, 2), os.path.basename(f)[:-4], fill='black', font=font); tiles.append(t)
for page in range(0, len(tiles), 8):
    part = tiles[page:page + 8]
    rows = [part[i:i + COLS] for i in range(0, len(part), COLS)]
    H = sum(max(t.height for t in r) + 8 for r in rows)
    c = Image.new('RGB', (COLS * (W + 8), H), (120, 120, 120)); y = 0
    for r in rows:
        for i, t in enumerate(r): c.paste(t, (i * (W + 8), y))
        y += max(t.height for t in r) + 8
    out = os.path.join(d, f'_sheet_{"-".join(keys)[:20]}_{page // 8 + 1}.jpg'); c.save(out, quality=82); print(out)

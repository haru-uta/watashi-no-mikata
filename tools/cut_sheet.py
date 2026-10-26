"""GPT の表（白地 or 透明地）を、絵のかたまりごとに切り分けて透明 PNG にする。

使い方: python tools/cut_sheet.py 表.png 出力の頭 列の数 最大の辺 名前1 名前2 ...
  名前は 左上から右へ、段ごとに並べる（2列なら 1段目左・右、2段目左・右…）。
"""
import sys
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

src, prefix = sys.argv[1], sys.argv[2]
COLS = int(sys.argv[3]); MAXSIDE = int(sys.argv[4]); names = sys.argv[5:]
im = Image.open(src).convert('RGBA')
a = np.array(im)
if a[..., 3].min() == 255:
    # 白地: 明るくて色の薄い所を地とみなす
    rgb = a[..., :3].astype(int)
    bg = (rgb.min(axis=2) > 236) & (rgb.max(axis=2) - rgb.min(axis=2) < 14)
    # 地のうち、ふちから続いている所だけを透明にする（白い毛を消さない）
    lab, _ = ndimage.label(bg)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    alpha = np.array(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8)))
    a[..., 3] = alpha
fg = a[..., 3] > 40
# かたまりの重心が入る升目ごとにまとめる（耳・しっぽが離れていても同じ升目なら1つ）
lab, n = ndimage.label(fg)
H, W = fg.shape
rows_n = len(names) // COLS
cells = {}
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    m = lab[sl] == i
    if m.sum() < 30:
        continue
    cy, cx = ndimage.center_of_mass(m)
    cy += sl[0].start; cx += sl[1].start
    key = (min(int(cy / H * rows_n), rows_n - 1), min(int(cx / W * COLS), COLS - 1))
    cells.setdefault(key, []).append(i)
if len(cells) != len(names):
    sys.exit(f'升目が {len(cells)} 個（名前は {len(names)} 個）: {src}')
for key, name in zip(sorted(cells), names):
    mask = np.isin(lab, cells[key])
    ys, xs = np.nonzero(mask)
    piece = a.copy(); piece[..., 3] = np.where(mask, piece[..., 3], 0)
    pad = 8
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, H)
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, W)
    p = Image.fromarray(piece).crop((x0, y0, x1, y1))
    p.thumbnail((MAXSIDE, MAXSIDE), Image.LANCZOS)
    p.save(f'{prefix}{name}.png', optimize=True)
    print(f'{prefix}{name}.png', p.size)

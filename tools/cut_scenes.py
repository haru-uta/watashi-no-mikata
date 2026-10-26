"""場面の表（2列×3段の 角丸の 絵）を 1まいずつ 切って JPEG にする。
使い方: python tools/cut_scenes.py 表.png 出力の頭   → 頭1.jpg … 頭6.jpg
"""
import sys
import numpy as np
from PIL import Image

src, prefix = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(int)
H, W, _ = a.shape
ink = (a.min(axis=2) < 235)  # 白い すきま 以外
n = 1
for r in range(3):
    for c in range(2):
        y0, y1, x0, x1 = H * r // 3, H * (r + 1) // 3, W * c // 2, W * (c + 1) // 2
        cell = ink[y0:y1, x0:x1]
        rows = np.nonzero(cell.mean(axis=1) > 0.25)[0]
        cols = np.nonzero(cell.mean(axis=0) > 0.25)[0]
        top, bot, left, right = y0 + rows.min(), y0 + rows.max(), x0 + cols.min(), x0 + cols.max()
        # 角の 丸みを おとす
        ix, iy = int((right - left) * 0.04), int((bot - top) * 0.04)
        piece = im.crop((left + ix, top + iy, right - ix, bot - iy))
        piece.thumbnail((800, 800), Image.LANCZOS)
        piece.save(f'{prefix}{n}.jpg', quality=84, optimize=True, progressive=True)
        print(f'{prefix}{n}.jpg', piece.size)
        n += 1

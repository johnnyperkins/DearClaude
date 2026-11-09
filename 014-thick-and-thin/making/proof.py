# Proof sheet: python proof.py font.ttf out.png [size] [text lines...]
import sys
from PIL import Image, ImageDraw, ImageFont

DEFAULT = ['nnonnoo hnhnh', 'hamburgefonstiv', 'the quick brown fox jumps over the lazy dog',
           'abcdefghijklmnopqrstuvwxyz', 'minimum swing, quietly', 'bed pod gaff tilt', 'savvy oxen wax lazy']
font, out = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 96
lines = sys.argv[4:] or DEFAULT
f = ImageFont.truetype(font, size, layout_engine=ImageFont.Layout.RAQM)
W = max(int(f.getlength(l)) for l in lines) + 2 * size
H = int(len(lines) * size * 1.35 + size)
im = Image.new('L', (W, H), 255)
d = ImageDraw.Draw(im)
for i, l in enumerate(lines):
    y = int(size * 0.5 + i * size * 1.35)
    base = y + int(size * 0.9)
    d.line([(0, base), (W, base)], fill=225)
    d.line([(0, base - int(size * 0.47)), (W, base - int(size * 0.47))], fill=235)
    d.text((size, y), l, font=f, fill=0, anchor='la')
im.save(out)
print(out, im.size)

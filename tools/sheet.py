# Tile stills into a labeled contact sheet: python3 sheet.py out.jpg cols thumb_w files...
import sys, os
from PIL import Image, ImageDraw

out, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
ims = [Image.open(f) for f in files]
th = int(tw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th + 26) + 6), (40, 40, 40))
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = 6 + (i % cols) * (tw + 6), 6 + (i // cols) * (th + 26)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 20))
    label = os.path.basename(f).rsplit('.', 1)[0].lstrip('t').lstrip('0') or '0'
    d.text((x + 2, y + 4), 't=' + label + 's', fill=(230, 230, 230))
sheet.save(out, quality=88)

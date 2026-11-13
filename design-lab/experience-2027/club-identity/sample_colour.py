"""Measure a shirt colour from an evidence screenshot (Club Identity Phase 2).

Usage:
  python -P sample_colour.py <image> info                      -> prints image size
  python -P sample_colour.py <image> <x1> <y1> <x2> <y2>        -> median colour of the box (image pixel coords)

Pick a box on well-lit shirt fabric only (avoid sponsor logos, numbers, shadows, skin).
The median is robust against small logos/creases. Prints JSON: hex, rgb, lightness/saturation and pixel count.
"""
import json
import sys
from statistics import median

from PIL import Image


def main():
    path = sys.argv[1]
    img = Image.open(path).convert("RGB")
    if len(sys.argv) < 4:
        print(json.dumps({"size": img.size}))
        return
    x1, y1, x2, y2 = (int(v) for v in sys.argv[2:6])
    box = img.crop((min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)))
    px = list(box.getdata())
    if not px:
        print(json.dumps({"error": "empty box"}))
        return
    r = int(median(p[0] for p in px)); g = int(median(p[1] for p in px)); b = int(median(p[2] for p in px))
    mx, mn = max(r, g, b) / 255, min(r, g, b) / 255
    light = (mx + mn) / 2
    sat = 0 if mx == mn else (mx - mn) / (1 - abs(2 * light - 1))
    print(json.dumps({"hex": "#%02X%02X%02X" % (r, g, b), "rgb": [r, g, b], "lightness": round(light, 3), "saturation": round(sat, 3), "pixels": len(px)}))


if __name__ == "__main__":
    main()

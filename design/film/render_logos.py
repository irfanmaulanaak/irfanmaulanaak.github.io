import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

here = os.path.dirname(os.path.abspath(__file__))
logos = os.path.join(here, "logos")
out = sys.argv[1] if len(sys.argv) > 1 else logos
os.makedirs(out, exist_ok=True)

COINS = {
    "bitcoin": {"bg": "#ffffff", "fg": "#F7931A", "scale": 1.0, "rim": "#c9760f"},
    "ethereum": {"bg": "#627EEA", "fg": "#ffffff", "scale": 0.62, "rim": "#4a63c4"},
    "tron": {"bg": None, "fg": None, "scale": 1.0, "rim": "#b3001d"},
    "solana": {"bg": "#0b0b0f", "fg": "url(#sol)", "scale": 0.56, "rim": "#1d1d24"},
    "ton": {"bg": "#ffffff", "fg": "#0098EA", "scale": 1.0, "rim": "#0079bb"},
    "xrp": {"bg": "#23292F", "fg": "#ffffff", "scale": 0.56, "rim": "#14181c"},
}
SIZE = 1024


def read(name):
    with open(os.path.join(logos, f"{name}.svg")) as fh:
        return fh.read()


def path_of(svg):
    return re.findall(r'<path[^>]*\sd="([^"]+)"', svg)


def coin_svg(name, spec):
    raw = read(name)
    if spec["bg"] is None:
        inner = re.sub(r"^<svg[^>]*>|</svg>$", "", raw.strip())
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 32 32">{inner}</svg>'
    d = " ".join(path_of(raw))
    s = spec["scale"]
    off = 12 * (1 - s)
    grad = '<defs><linearGradient id="sol" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs>'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 24 24">{grad}'
        f'<circle cx="12" cy="12" r="12" fill="{spec["bg"]}"/>'
        f'<g transform="translate({off} {off}) scale({s})"><path d="{d}" fill="{spec["fg"]}" fill-rule="evenodd"/></g></svg>'
    )


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": SIZE, "height": SIZE}, device_scale_factor=1)
    for name, spec in COINS.items():
        pg.set_content(f'<html><body style="margin:0;background:transparent">{coin_svg(name, spec)}</body></html>')
        pg.locator("svg").screenshot(path=os.path.join(out, f"coin-{name}.png"), omit_background=True)
    visa = " ".join(path_of(read("visa")))
    pg.set_content(f'<html><body style="margin:0"><svg id="v" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="{visa}" fill="#ffffff"/></svg></body></html>')
    box = pg.evaluate("(() => { const b = document.querySelector('#v path').getBBox(); return [b.x, b.y, b.width, b.height]; })()")
    x, y, w, h = box
    pad = 0.2
    width = 1400
    height = round(width * (h + 2 * pad) / (w + 2 * pad))
    pg.set_viewport_size({"width": width, "height": height})
    pg.set_content(
        f'<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="{x - pad} {y - pad} {w + 2 * pad} {h + 2 * pad}"><path d="{visa}" fill="#ffffff"/></svg></body></html>'
    )
    pg.locator("svg").screenshot(path=os.path.join(out, "visa.png"), omit_background=True)
    b.close()

with open(os.path.join(out, "coins.json"), "w") as fh:
    json.dump({"rims": {k: v["rim"] for k, v in COINS.items()}, "visa_aspect": round((w + 2 * pad) / (h + 2 * pad), 4)}, fh)
print("ok", sorted(os.listdir(out)))

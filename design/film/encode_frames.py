import glob
import json
import os
import sys

from PIL import Image

src, site = sys.argv[1], sys.argv[2]
tracks = sys.argv[3] if len(sys.argv) > 3 else None
out = os.path.join(site, "assets", "film")
sizes = {"d": ((1920, 1200), 72), "m": ((960, 600), 66)}
posters = {"flur": 100, "horizon": 170, "bitzaro": 246}

for key in sizes:
    os.makedirs(os.path.join(out, key), exist_ok=True)

totals = {key: 0 for key in sizes}
files = sorted(glob.glob(os.path.join(src, "f*.png")))
MOBILE_STEP = 2
total = len(files)
for key in sizes:
    for old in glob.glob(os.path.join(out, key, "f*.webp")):
        os.remove(old)
for path in files:
    n = int(os.path.basename(path)[1:5])
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, "#111111")
    bg.alpha_composite(im)
    flat = bg.convert("RGB")
    for key, (size, q) in sizes.items():
        if key == "m" and (n - 1) % MOBILE_STEP and n != total:
            continue
        dst = os.path.join(out, key, f"f{n:04d}.webp")
        flat.resize(size, Image.LANCZOS).save(dst, "WEBP", quality=q, method=6)
        totals[key] += os.path.getsize(dst)
    for name, frame in posters.items():
        if frame == n:
            flat.resize((1280, 800), Image.LANCZOS).save(os.path.join(out, f"poster-{name}.webp"), "WEBP", quality=78, method=6)

if tracks:
    with open(tracks) as fh:
        data = json.load(fh)
    with open(os.path.join(out, "tracks.json"), "w") as fh:
        json.dump(data, fh, separators=(",", ":"))

print(json.dumps({"frames": len(files), "mb": {k: round(v / 1e6, 2) for k, v in totals.items()}}))

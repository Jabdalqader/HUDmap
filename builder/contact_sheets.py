import os
import requests
from PIL import Image, ImageDraw, ImageFont
from stops_seed import STOPS

ALL = "photo_candidates/all"
os.makedirs(ALL, exist_ok=True)
TILE, COLS = 300, 5


def navcam_full_for_sol(sol):
    found, page = [], 0
    while True:
        url = (
            "https://mars.nasa.gov/api/v1/raw_image_items/"
            f"?order=sol%20desc&per_page=50&page={page}&condition_1=msl:mission"
            f"&condition_2={sol}:sol:gte&condition_3={sol}:sol:lte"
        )
        data = requests.get(url, timeout=60).json()
        for it in data.get("items", []):
            if (it.get("instrument") == "NAV_LEFT_B"
                    and it.get("extended", {}).get("sample_type") == "full"):
                found.append(it)
        if not data.get("more") or page >= 30:
            break
        page += 1
    return found


font = ImageFont.load_default(size=36)

for s in STOPS:
    print(f"Stop {s['id']} {s['name']} (sol {s['sol']}) ...", flush=True)
    items = navcam_full_for_sol(s["sol"])
    tiles = []
    for i, it in enumerate(items):
        path = f"{ALL}/stop{s['id']}_{i}.jpg"
        with open(path, "wb") as f:
            f.write(requests.get(it["url"], timeout=60).content)
        im = Image.open(path).convert("RGB").resize((TILE, TILE))
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 70, 44], fill=(0, 0, 0))
        d.text((6, 2), str(i), fill=(255, 255, 0), font=font)
        tiles.append(im)
    rows = (len(tiles) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * TILE, rows * TILE), (0, 0, 0))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % COLS) * TILE, (i // COLS) * TILE))
    sheet.save(f"photo_candidates/sheet_stop{s['id']}.jpg")
    print(f"  {len(tiles)} frames -> photo_candidates/sheet_stop{s['id']}.jpg", flush=True)
import os
import requests
from PIL import Image
from stops_seed import STOPS

OUT = "photo_candidates"
os.makedirs(OUT, exist_ok=True)


def fetch_items(sol):
    url = (
        "https://mars.nasa.gov/api/v1/raw_image_items/"
        f"?order=sol%20desc&per_page=50&page=0&condition_1=msl:mission"
        f"&condition_2={sol}:sol:gte&condition_3={sol}:sol:lte"
    )
    return requests.get(url, timeout=60).json().get("items", [])


def dark_fraction(path):
    im = Image.open(path).convert("L")
    px = list(im.getdata())
    return sum(1 for v in px if v < 15) / len(px)


for s in STOPS:
    sol = s["sol"]
    items = fetch_items(sol)
    full = [i for i in items if i.get("extended", {}).get("sample_type") == "full"]
    print(f"\nStop {s['id']} {s['name']} (sol {sol}): {len(items)} items, {len(full)} full")
    for n, it in enumerate(full[:6]):
        path = f"{OUT}/stop{s['id']}_{n}.jpg"
        r = requests.get(it["url"], timeout=60)
        with open(path, "wb") as f:
            f.write(r.content)
        w, h = Image.open(path).size
        print(f"  {path} | {it['instrument']:<10} | {w}x{h} | dark={dark_fraction(path):.0%}")
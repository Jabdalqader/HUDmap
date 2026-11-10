import os
import requests
from PIL import Image
from stops_seed import STOPS

OUT = "photo_candidates"
os.makedirs(OUT, exist_ok=True)


def navcam_full(sol_lo, sol_hi):
    found = []
    for page in range(0, 4):
        url = (
            "https://mars.nasa.gov/api/v1/raw_image_items/"
            f"?order=sol%20desc&per_page=50&page={page}&condition_1=msl:mission"
            f"&condition_2={sol_lo}:sol:gte&condition_3={sol_hi}:sol:lte"
        )
        data = requests.get(url, timeout=60).json()
        for it in data.get("items", []):
            if (it.get("instrument") == "NAV_LEFT_B"
                    and it.get("extended", {}).get("sample_type") == "full"):
                found.append(it)
        if not data.get("more"):
            break
    return found


for s in STOPS:
    sol = s["sol"]
    for spread in (0, 3, 10):
        items = navcam_full(sol - spread, sol + spread)
        if items:
            break
    print(f"\nStop {s['id']} {s['name']} (sol {sol}): {len(items)} Navcam full frames (searched +-{spread} sols)")
    step = max(1, len(items) // 4)
    for n, it in enumerate(items[::step][:4]):
        path = f"{OUT}/nav_stop{s['id']}_{n}.jpg"
        with open(path, "wb") as f:
            f.write(requests.get(it["url"], timeout=60).content)
        w, h = Image.open(path).size
        print(f"  {path} | sol {it['sol']} | {w}x{h}")
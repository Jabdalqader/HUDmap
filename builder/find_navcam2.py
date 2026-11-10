import os
import requests
from PIL import Image
from stops_seed import STOPS

OUT = "photo_candidates"
os.makedirs(OUT, exist_ok=True)
MAX_OFFSET = 5  # how many sols either side we are willing to search


def navcam_full_for_sol(sol):
    found = []
    page = 0
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


offsets = [0]
for k in range(1, MAX_OFFSET + 1):
    offsets += [-k, k]

for s in STOPS:
    if s["id"] == 0:
        continue  # stop 0 already has Navcam frames
    print(f"\nStop {s['id']} {s['name']} (sol {s['sol']})")
    items, used_sol = [], None
    for off in offsets:
        sol = s["sol"] + off
        print(f"  checking sol {sol} ...", flush=True)
        items = navcam_full_for_sol(sol)
        if items:
            used_sol = sol
            break
    if not items:
        print(f"  no Navcam full frames within +-{MAX_OFFSET} sols")
        continue
    print(f"  FOUND {len(items)} frames on sol {used_sol}")
    step = max(1, len(items) // 4)
    for n, it in enumerate(items[::step][:4]):
        path = f"{OUT}/nav2_stop{s['id']}_{n}.jpg"
        with open(path, "wb") as f:
            f.write(requests.get(it["url"], timeout=60).content)
        w, h = Image.open(path).size
        print(f"  {path} | sol {it['sol']} | {w}x{h}")
import requests
from collections import Counter
from stops_seed import STOPS

for s in STOPS:
    sol = s["sol"]
    counts = Counter()
    for page in range(0, 6):  # up to 300 items
        url = (
            "https://mars.nasa.gov/api/v1/raw_image_items/"
            f"?order=sol%20desc&per_page=50&page={page}&condition_1=msl:mission"
            f"&condition_2={sol}:sol:gte&condition_3={sol}:sol:lte"
        )
        data = requests.get(url, timeout=60).json()
        for it in data.get("items", []):
            st = it.get("extended", {}).get("sample_type", "?")
            counts[(it.get("instrument", "?"), st)] += 1
        if not data.get("more"):
            break
    print(f"\nStop {s['id']} {s['name']} (sol {sol}), total reported: {data.get('total')}")
    for (inst, st), n in sorted(counts.items()):
        print(f"  {inst:<14} {st:<10} {n}")
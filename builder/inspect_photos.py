import requests

SOL = 4639  # the Steep ridge sol, we test with one stop first

URL = (
    "https://mars.nasa.gov/api/v1/raw_image_items/"
    f"?order=sol%20desc&per_page=50&page=0&condition_1=msl:mission"
    f"&condition_2={SOL}:sol:gte&condition_3={SOL}:sol:lte"
)

resp = requests.get(URL, timeout=60)
print("HTTP status:", resp.status_code)

data = resp.json()
print("Top-level keys:", list(data.keys()))

items = data.get("items", [])
print("Number of items:", len(items))

if items:
    first = items[0]
    print("\nKeys of the first item:", list(first.keys()))
    print("Extended keys:", list(first.get("extended", {}).keys()))

print("\n#  | instrument      | sample_type | url")
for i, it in enumerate(items[:25]):
    inst = it.get("instrument", "?")
    st = it.get("extended", {}).get("sample_type", "?")
    print(f"{i:<2} | {inst:<15} | {st:<11} | {it.get('url', '?')}")
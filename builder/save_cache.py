import json
from sources.nasa import NasaWaypointSource

wps = NasaWaypointSource().get_waypoints(4596, 4820)
with open("cache/waypoints.json", "w") as f:
    json.dump(wps, f, indent=2)
print(f"Saved {len(wps)} waypoints")
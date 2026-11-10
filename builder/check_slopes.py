from sources.local import JsonFileWaypointSource
from stops_seed import STOPS
from geo import dist_m, nearest_point

source = JsonFileWaypointSource("cache/waypoints.json")
route = source.get_waypoints(4596, 4820)

print(f"{len(route)} route points loaded\n")
print("stop | name         | nearest sol | dist (m) | slope | hazard (>12)")
for s in STOPS:
    near = nearest_point(route, *s["mars"])
    d = dist_m(near["lat"], near["lon"], *s["mars"])
    hazard = "YES" if near["slope"] > 12 else "no"
    print(f"{s['id']}    | {s['name']:<12} | {near['sol']:<11} | {d:<8.1f} | {near['slope']:<5} | {hazard}")
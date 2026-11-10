"""Build the one official mission file: web/mission/mission.json.

It serves every part of the project, so it carries the fields each part reads:
  HUD (T1.4)     route[].mars + slope_deg, stops[].photo + conditions, anchor, suit
  Voice (T1.2)   mission_name, location, stops[].description + tasks
  Sim (T1.3)     route[].lat/lon, stops[].mars + panorama
  Plan (T1.1)    route[].elev/slope, stops[].temp_c/rad_uSv_h/sources, layers

Data: Curiosity waypoints (route, height, tilt), Curiosity REMS (temperature, pressure per sol),
RAD surface average, AI1's stop photos (web/mission/assets/stopN.jpg).

Usage:  python builder/build_official_mission.py
"""
import json
import math
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "web", "mission", "mission.json")
WAYPOINTS = "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json"
REMS = "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json"
MARS_R = 3396190.0
RAD_uSv_h = 27.9            # Curiosity RAD surface average 0.67 mSv/day (Hassler et al. 2014)
FIRST_SOL, LAST_SOL = 4596, 4820

STOPS = [
    (0, "Base", 4596, -4.803606, 137.380074,
     "Suit check, then start the walk.", "None",
     "Edge of the boxwork field: from here low ridges spread out like a spiderweb."),
    (1, "First ridges", 4618, -4.805495, 137.379536,
     "Find the dark crack along a ridge top.", "Loose sand at the foot of the ridge",
     "Boxwork is a web of low ridges. Groundwater flowed through cracks and left minerals that hardened them; wind later wore away the softer rock in between."),
    (2, "Steep ridge", 4639, -4.806553, 137.379317,
     "Photograph the central fracture along the ridge top.", "Steep slope (about 15 degrees): walk slowly",
     "The dark line along the ridge is a fracture where groundwater flowed and concentrated minerals."),
    (3, "Hollow", 4655, -4.807168, 137.379896,
     "Look for small round nodules on the ridge walls.", "Soft sand in the hollow",
     "Curiosity found nodules along ridge walls and in hollows but not near the fractures, which is still unexplained."),
    (4, "Main site", 4711, -4.808008, 137.381004,
     "Collect paired samples: one from a ridge, one from the hollow.", "Sharp rock edges",
     "Curiosity drilled here and found clay minerals in a ridge and carbonate minerals in a hollow."),
    (5, "Exit", 4820, -4.807785, 137.382671,
     "Take a context photo of the sulfate layer, then return to base.", "Long walk back to base",
     "The boxwork sits in a layer rich in salty sulfate minerals that Curiosity keeps exploring."),
]


def cached_json(url, name):
    path = os.path.join(HERE, "cache", name)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        urllib.request.urlretrieve(url, path)
    with open(path) as fh:
        return json.load(fh)


def main():
    wps = [f["properties"] for f in cached_json(WAYPOINTS, "MSL_waypoints.json")["features"]]
    wps = sorted((w for w in wps if FIRST_SOL <= int(w["sol"]) <= LAST_SOL), key=lambda w: w["dist_total_m"])
    rems = {s["sol"]: s for s in cached_json(REMS, "rems_weather.json")["soles"]}

    route = []
    for i, w in enumerate(wps):
        nxt = wps[min(i + 1, len(wps) - 1)]
        dn = (nxt["lat"] - w["lat"]) * MARS_R * math.pi / 180
        de = (nxt["lon"] - w["lon"]) * MARS_R * math.pi / 180 * math.cos(math.radians(w["lat"]))
        dist = math.hypot(dn, de)
        grade = math.degrees(math.atan2(abs(nxt["elev_geoid"] - w["elev_geoid"]), dist)) if dist > 0.5 else 0.0
        lat, lon = round(w["lat"], 7), round(w["lon"], 7)
        route.append({
            "lat": lat, "lon": lon, "mars": [lat, lon], "sol": int(w["sol"]),
            "elev": round(w["elev_geoid"], 1),
            "slope": w["tilt"],                                   # rover tilt at this point (degrees)
            "slope_deg": round(max(grade, w["tilt"] * 0.8), 1),   # slope towards the next point (HUD steep-ground alert)
        })

    stops = []
    for sid, name, sol, lat, lon, task, hazard, science in STOPS:
        r = rems.get(str(sol), {})
        tmin, tmax = r.get("min_temp"), r.get("max_temp")
        temp = round((float(tmin) + float(tmax)) / 2) if tmin not in (None, "--") and tmax not in (None, "--") else None
        pressure = int(r["pressure"]) if r.get("pressure") not in (None, "--") else None
        slope = max((p["slope"] for p in route if abs(p["lat"] - lat) < 2e-5 and abs(p["lon"] - lon) < 2e-5), default=None)
        conditions = {"temp_c": temp, "pressure_pa": pressure, "rad_uSv_h": RAD_uSv_h,
                      "source": f"REMS sol {sol} (average of min {tmin} / max {tmax} °C, pressure); RAD surface average"}
        stops.append({
            "id": sid, "name": name, **({"is_base": True} if sid == 0 else {}), "mars": [lat, lon], "field": None, "sol": sol,
            "slope_deg": slope, "hazard": hazard,
            "task": task, "tasks": [task],
            "science": science, "description": science,
            "temp_c": temp, "rad_uSv_h": RAD_uSv_h, "conditions": conditions,
            "photo": f"/mission/assets/stop{sid}.jpg", "photos": [f"assets/stop{sid}.jpg"],
            "panorama": f"assets/pano_stop{sid}.jpg",
            "sources": ["Curiosity waypoints (MMGIS)", f"Curiosity Navcam sol {sol}", f"Curiosity REMS sol {sol}",
                        "NASA/JPL boxwork article 2026-02-23"],
        })

    mission = {
        "mission_id": "boxwork-01",
        "mission_name": "Mount Sharp Boxwork Walk",
        "location": "Mount Sharp boxwork, Gale Crater, Mars",
        "site": "Mount Sharp boxwork, Gale Crater, Mars",
        "is_mock": False,
        "mars_radius_m": MARS_R,
        "anchor": {"mars": [STOPS[0][3], STOPS[0][4]], "field": None, "rotation_deg": 0, "scale": 1.0},
        "route": route,
        "layers": [
            {"id": "hirise", "name": "Photo", "mission": "MRO", "instrument": "HiRISE", "kind": "optical",
             "tiles": "https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/{z}/{y}/{x}.png"},
            {"id": "route", "name": "Route slope", "mission": "MSL", "instrument": "Curiosity waypoints", "kind": "topographic"},
            {"id": "weather", "name": "Weather + radiation", "mission": "MSL", "instrument": "REMS / RAD", "kind": "atmospheric"},
        ],
        "stops": stops,
        "suit": {"o2_start_pct": 100, "o2_pct_per_min": 0.25, "walk_speed_mps": 0.8},
    }
    with open(OUT, "w") as fh:
        json.dump(mission, fh, indent=1)
    print(f"wrote {OUT}: {len(route)} route points, {len(stops)} stops")
    for s in stops:
        print(f"  {s['id']} {s['name']:<13} sol {s['sol']}  {s['temp_c']} °C  {s['conditions']['pressure_pa']} Pa  slope {s['slope_deg']}")


if __name__ == "__main__":
    main()

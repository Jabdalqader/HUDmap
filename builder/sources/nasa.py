import requests

WAYPOINTS_URL = "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json"


class NasaWaypointSource:
    def get_waypoints(self, sol_min, sol_max):
        data = requests.get(WAYPOINTS_URL, timeout=60).json()
        out = []
        for f in data["features"]:
            p = f["properties"]
            sol = p.get("sol")
            if sol is not None and sol_min <= sol <= sol_max:
                out.append({
                    "sol": sol,
                    "lat": p["lat"],
                    "lon": p["lon"],
                    "elev": p["elev_geoid"],
                    "slope": p["tilt"],
                })
        return sorted(out, key=lambda w: w["sol"])
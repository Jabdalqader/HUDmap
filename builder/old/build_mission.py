import requests
import json
import os
import urllib.request

# 1. GET THE ROUTE
url = "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json"
print("Knocking on NASA's door for the route...")
data = requests.get(url).json()

route_points = []
for point in data['features']:
    properties = point['properties']
    sol = properties.get('sol')
    if sol is not None and 4596 <= sol <= 4820:
        route_points.append({
            "lat": properties.get('lat'),
            "lon": properties.get('lon'),
            "elev": properties.get('elev_geoid'),
            "slope": properties.get('tilt')
        })

# 2. GET THE PICTURES
my_folder = os.path.dirname(os.path.abspath(__file__))
assets_folder = os.path.join(my_folder, "assets")
if not os.path.exists(assets_folder):
    os.makedirs(assets_folder)

stops_sols = [4596, 4618, 4639, 4655, 4711, 4820]
print("\nChecking for pictures...")
for i, sol in enumerate(stops_sols):
    file_name = os.path.join(assets_folder, f"stop{i}.jpg")
    # Only download if we don't already have it
    if not os.path.exists(file_name): 
        photo_url = f"https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc&per_page=50&page=0&condition_1=msl:mission&condition_2={sol}:sol:gte&condition_3={sol}:sol:lte"
        photo_data = requests.get(photo_url).json()
        for item in photo_data.get('items', []):
            instrument = item.get('instrument', '')
            sample_type = item.get('extended', {}).get('sample_type', '')
            if sample_type == "full" and (instrument == "NAV_LEFT_B" or instrument == "MAST_LEFT"):
                urllib.request.urlretrieve(item.get('url'), file_name)
                print(f"  -> Downloaded: stop{i}.jpg")
                break 

# 3. BUILD THE FINAL MISSION.JSON
print("\nBuilding the final mission.json file...")

final_mission_data = {
  "mission_id": "boxwork-01",
  "site": "Mount Sharp boxwork, Gale Crater, Mars",
  "anchor": {
    "mars": [-4.803606, 137.380074],
    "field": [0, 0], # We will change this to the Jordan desert coordinates later!
    "rotation_deg": 0,
    "scale": 1.0
  },
  "route": route_points, # <--- Here is the real path we downloaded!
  "layers": [
    {
      "id": "hirise",
      "name": "Photo",
      "mission": "MRO",
      "instrument": "HiRISE",
      "kind": "optical",
      "tiles": "https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/{z}/{y}/{x}.png"
    },
    {
      "id": "minerals",
      "name": "Minerals",
      "mission": "MRO",
      "instrument": "CRISM",
      "kind": "spectral",
      "image": "assets/crism.png",
      "bounds": [[-4.811, 137.378], [-4.802, 137.384]]
    }
  ],
  "stops": [
    {
      "id": 0, "name": "Base", "mars": [-4.803606, 137.380074], "field": None, "sol": 4596, "slope_deg": 0,
      "hazard": "Flat area, safe to proceed.", "task": "Check oxygen levels and begin the walk.", "science": "This is the entry point to the ancient boxwork formations.",
      "temp_c": -60, "rad_uSv_h": 28, "photos": ["assets/stop0.jpg"], "sources": ["MSL waypoints"]
    },
    {
      "id": 1, "name": "First ridges", "mars": [-4.805495, 137.379536], "field": None, "sol": 4618, "slope_deg": 5,
      "hazard": "Uneven ground, watch your step.", "task": "Take a photo of the first visible mineral veins.", "science": "These ridges show where ancient groundwater cracked the rock.",
      "temp_c": -60, "rad_uSv_h": 28, "photos": ["assets/stop1.jpg"], "sources": ["MSL waypoints"]
    },
    {
      "id": 2, "name": "Steep ridge", "mars": [-4.806553, 137.379317], "field": None, "sol": 4639, "slope_deg": 15,
      "hazard": "Steep slope (15 degrees), walk slowly.", "task": "Photograph the dark crack on the ridge top.", "science": "The ridge is rock hardened by minerals from old groundwater.",
      "temp_c": -60, "rad_uSv_h": 28, "photos": ["assets/stop2.jpg"], "sources": ["MSL waypoints"]
    },
    {
      "id": 3, "name": "Hollow", "mars": [-4.807168, 137.379896], "field": None, "sol": 4655, "slope_deg": 2,
      "hazard": "Possible soft sand, check footing.", "task": "Inspect the ground for loose soil samples.", "science": "Hollows like this can trap wind-blown Martian dust.",
      "temp_c": -60, "rad_uSv_h": 28, "photos": ["assets/stop3.jpg"], "sources": ["MSL waypoints"]
    },
    {
      "id": 4, "name": "Main site", "mars": [-4.808008, 137.381004], "field": None, "sol": 4711, "slope_deg": 6,
      "hazard": "Moderate slope, safe for extended work.", "task": "Collect a carbonate rock sample.", "science": "This area contains the highest concentration of boxwork minerals.",
      "temp_c": -60, "rad_uSv_h": 28, "photos": ["assets/stop4.jpg"], "sources": ["MSL waypoints"]
    },
    {
      "id": 5, "name": "Exit", "mars": [-4.807785, 137.382671], "field": None, "sol": 4820, "slope_deg": 4,
      "hazard": "End of route, turn back.", "task": "Verify oxygen for the return trip.", "science": "This marks the edge of the currently explored boxwork region.",
      "temp_c": -60, "rad_uSv_h": 28, "photos": ["assets/stop5.jpg"], "sources": ["MSL waypoints"]
    }
  ],
  "suit": {
    "o2_start_pct": 100,
    "o2_pct_per_min": 0.25,
    "walk_speed_mps": 0.8
  }
}

# Save it to the file!
file_path = os.path.join(my_folder, "mission.json")
with open(file_path, "w") as file:
    json.dump(final_mission_data, file, indent=2)

print("SUCCESS! The real mission.json file is ready.")
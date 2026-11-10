"""Build the 3D ground for the VR simulation.

Output (web/mission/terrain/):
  ortho.jpg      HiRISE satellite photo of the area (NASA MRO HiRISE, via Mars Trek), ~0.63 m/pixel
  heights.bin    ground height grid, float32 metres, row 0 = north edge, relative to the base stop
  terrain.json   size, grid, and where the base stop sits

Heights: Curiosity's measured elevations (every waypoint in the area) smoothly interpolated,
plus a small relief (< 1 m) taken from the photo's light/dark pattern so ridges look 3D.
The relief is visual only; the large-scale shape is measured.

Usage:  python builder/terrain.py
"""
import json
import math
import os
import urllib.request

import numpy as np
from PIL import Image, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "web", "mission", "terrain")
CACHE = os.path.join(HERE, "cache", "hirise")
TILE = "https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/16/{row}/{col}.png"
WAYPOINTS = "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json"
MARS_R = 3396190.0
Z = 16
T = 180.0 / 2 ** Z                      # degrees per tile at zoom 16
COLS = range(115552, 115558)            # 6 tiles west -> east   (~970 m)
ROWS = range(34514, 34522)              # 8 tiles north -> south (~1300 m)
BASE = (-4.803606, 137.380074)          # stop 0 (lat, lon) = origin of the 3D world
GRID_STEP = 4                           # one height sample every 4 photo pixels (~2.5 m)
RELIEF_M = 0.8                          # max visual relief from the photo


def tile(row, col):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, f"{row}_{col}.png")
    if not os.path.exists(p):
        urllib.request.urlretrieve(TILE.format(row=row, col=col), p)
    return Image.open(p).convert("L")


def waypoints():
    p = os.path.join(HERE, "cache", "MSL_waypoints.json")
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        urllib.request.urlretrieve(WAYPOINTS, p)
    with open(p) as fh:
        return [f["properties"] for f in json.load(fh)["features"]]


def main():
    # ---- photo
    w, h = 256 * len(COLS), 256 * len(ROWS)
    ortho = Image.new("L", (w, h))
    for i, r in enumerate(ROWS):
        for j, c in enumerate(COLS):
            ortho.paste(tile(r, c), (j * 256, i * 256))
    lon_w, lon_e = COLS[0] * T - 180, (COLS[-1] + 1) * T - 180
    lat_n, lat_s = 90 - ROWS[0] * T, 90 - (ROWS[-1] + 1) * T

    # metres per degree here
    m_lat = MARS_R * math.pi / 180
    m_lon = m_lat * math.cos(math.radians(BASE[0]))
    width_m, height_m = (lon_e - lon_w) * m_lon, (lat_n - lat_s) * m_lat

    # ---- heights from rover waypoints (inverse-distance weighting)
    gw, gh = w // GRID_STEP + 1, h // GRID_STEP + 1
    pts = [(p["lon"], p["lat"], p["elev_geoid"]) for p in waypoints()
           if lon_w - 0.002 < p["lon"] < lon_e + 0.002 and lat_s - 0.002 < p["lat"] < lat_n + 0.002]
    P = np.array(pts)
    # interpolate on a coarse grid (~10 m), then smooth-upscale: fast and smooth
    cw, ch = max(8, gw // 4), max(8, gh // 4)
    LON, LAT = np.meshgrid(np.linspace(lon_w, lon_e, cw), np.linspace(lat_n, lat_s, ch))
    coarse = np.zeros((ch, cw))
    for k in range(ch):                          # row by row keeps memory small
        dx = (LON[k, :, None] - P[:, 0]) * m_lon
        dy = (LAT[k, :, None] - P[:, 1]) * m_lat
        wgt = 1.0 / (dx ** 2 + dy ** 2 + 25.0 ** 2) ** 1.5   # 25 m softening keeps it smooth
        coarse[k] = (wgt * P[:, 2]).sum(-1) / wgt.sum(-1)
    elev = np.asarray(Image.fromarray(coarse.astype(np.float32), "F").resize((gw, gh), Image.BICUBIC), np.float64)

    base_elev = float(P[np.argmin((P[:, 0] - BASE[1]) ** 2 + (P[:, 1] - BASE[0]) ** 2), 2])
    elev = elev - base_elev

    # ---- small visual relief from the photo (bright = slightly higher), high-pass filtered
    small = ortho.resize((gw, gh), Image.BILINEAR)
    a = np.asarray(small, np.float32)
    blur = np.asarray(small.filter(ImageFilter.GaussianBlur(6)), np.float32)
    hp = a - blur
    hp = np.clip(hp / (np.percentile(np.abs(hp), 98) + 1e-6), -1, 1)
    elev = elev + hp * RELIEF_M

    os.makedirs(OUT, exist_ok=True)
    # stronger contrast so ridges and sand stand out in 3D
    vivid = ImageOps.autocontrast(ortho, cutoff=1).filter(ImageFilter.UnsharpMask(radius=12, percent=90, threshold=2))
    vivid.save(os.path.join(OUT, "ortho.jpg"), quality=88)
    elev.astype("<f4").tofile(os.path.join(OUT, "heights.bin"))

    base_x = (BASE[1] - lon_w) * m_lon - width_m / 2      # base position relative to terrain centre
    base_z = (lat_n - BASE[0]) * m_lat - height_m / 2
    meta = {
        "source_photo": "NASA MRO HiRISE (curiosity_hirise_mosaic, Mars Trek)",
        "source_heights": f"Curiosity waypoint elevations ({len(P)} points) + {RELIEF_M} m visual relief from the photo",
        "bounds": {"north": lat_n, "south": lat_s, "west": lon_w, "east": lon_e},
        "width_m": round(width_m, 2), "height_m": round(height_m, 2),
        "grid": [gw, gh],
        "base": {"lat": BASE[0], "lon": BASE[1], "elev_m": base_elev},
        # where the base sits, in metres from the terrain centre (x east, z south)
        "base_offset_m": [round(base_x, 2), round(base_z, 2)],
        "mars_radius_m": MARS_R,
        "height_range_m": [round(float(elev.min()), 2), round(float(elev.max()), 2)],
    }
    with open(os.path.join(OUT, "terrain.json"), "w") as fh:
        json.dump(meta, fh, indent=2)
    print(f"terrain {width_m:.0f} x {height_m:.0f} m, grid {gw}x{gh}, {len(P)} waypoints, "
          f"heights {elev.min():.1f}..{elev.max():.1f} m")


if __name__ == "__main__":
    main()

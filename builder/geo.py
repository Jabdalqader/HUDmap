import math

R_MARS = 3396190  # meters


def dist_m(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = p2 - p1
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * R_MARS * math.asin(math.sqrt(a))


def nearest_point(route, lat, lon):
    return min(route, key=lambda p: dist_m(p["lat"], p["lon"], lat, lon))
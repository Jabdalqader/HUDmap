import json


class JsonFileWaypointSource:
    def __init__(self, path):
        self.path = path

    def get_waypoints(self, sol_min, sol_max):
        with open(self.path) as f:
            data = json.load(f)
        return [w for w in data if sol_min <= w["sol"] <= sol_max]
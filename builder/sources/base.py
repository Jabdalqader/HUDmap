from typing import Protocol


class WaypointSource(Protocol):
    def get_waypoints(self, sol_min: int, sol_max: int) -> list[dict]:
        """Return [{'sol','lat','lon','elev','slope'}, ...] sorted by sol."""
        ...

import type {
  MissionStatus,
  StatusProvider,
} from "../contracts/MissionStatus";

export class MockStatusProvider implements StatusProvider {
  async getStatus(): Promise<MissionStatus> {
    return {
      stop: 2,
      stop_name: "Steep ridge",
      dist_next_m: 41,
      dist_base_m: 410,
      o2_pct: 82,
      o2_minutes_left: 328,
      must_return: false,
      rad_uSv_h: 28,
      temp_c: -60,
    };
  }
}

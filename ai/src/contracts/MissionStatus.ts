
export interface MissionStatus {
  stop: number;
  stop_name: string;
  dist_next_m: number;
  dist_base_m: number;
  o2_pct: number;
  o2_minutes_left: number;
  must_return: boolean;
  rad_uSv_h: number;
  temp_c: number;
}

export interface StatusProvider {
  getStatus(): Promise<MissionStatus>;
}

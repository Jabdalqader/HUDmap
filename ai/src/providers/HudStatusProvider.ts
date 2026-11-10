
import type {
  MissionStatus,
  StatusProvider,
} from "../contracts/MissionStatus";

export interface HudAdapter {
  getStatus(): MissionStatus | Promise<MissionStatus>;
}

export class HudStatusProvider implements StatusProvider {
  constructor(private readonly hud: HudAdapter) {}

  async getStatus(): Promise<MissionStatus> {
    return await this.hud.getStatus();
  }
}

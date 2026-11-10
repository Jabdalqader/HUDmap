
import type { StopCard, StopCardProvider } from "../contracts/MissionData";

/**
 * Stop card lookup for the HUD and the assistant. Depends only on
 * `StopCardProvider`, so the cards can come from mission data or from
 * separate official files.
 *
 * Call `preload()` once at startup. After that the cards are cached in
 * memory and stay available if ElevenLabs or the network goes away.
 */
export class StopCardService {
  private cards?: Promise<Map<number, StopCard>>;

  constructor(private readonly provider: StopCardProvider) {}

  async preload(): Promise<void> {
    await this.load();
  }

  async getAllStopCards(): Promise<StopCard[]> {
    return [...(await this.load()).values()];
  }

  /** Returns `undefined` for an unknown stop id. Callers decide how to show "no card". */
  async getStopCard(stopId: number): Promise<StopCard | undefined> {
    return (await this.load()).get(stopId);
  }

  private load(): Promise<Map<number, StopCard>> {
    if (!this.cards) {
      this.cards = this.provider
        .getStopCards()
        .then((cards) => new Map(cards.map((card) => [card.stopId, card])));
      this.cards.catch(() => {
        this.cards = undefined;
      });
    }
    return this.cards;
  }
}

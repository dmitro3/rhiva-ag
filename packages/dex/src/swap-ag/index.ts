import { Jupiter } from "./jupiter";

export { Jupiter };

export class SwapAggregator {
  jupiter: Jupiter;

  constructor() {
    this.jupiter = new Jupiter("https://lite-api.jup.ag");
  }
}

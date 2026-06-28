import { describe, it, expect } from "vitest";
import { addBags, scaleBag, subtractBags, canAfford } from "../src/index.js";

describe("economy helpers", () => {
  it("adds bags, summing shared keys", () => {
    expect(addBags({ gold: 10, food: 5 }, { gold: 3, fuel: 2 })).toEqual({
      gold: 13,
      food: 5,
      fuel: 2,
    });
  });

  it("scales a bag", () => {
    expect(scaleBag({ gold: 10, fuel: 4 }, 2)).toEqual({ gold: 20, fuel: 8 });
  });

  it("subtracts bags", () => {
    expect(subtractBags({ gold: 10, food: 5 }, { gold: 4 })).toEqual({
      gold: 6,
      food: 5,
    });
  });

  it("checks affordability", () => {
    const wallet = { gold: 100, ore: 5, steel: 5 };
    expect(canAfford(wallet, { gold: 100, ore: 5, steel: 5 })).toBe(true);
    expect(canAfford(wallet, { gold: 101 })).toBe(false);
    expect(canAfford(wallet, { ore: 6 })).toBe(false);
    expect(canAfford(wallet, {})).toBe(true);
  });
});

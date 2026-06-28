import { describe, it, expect } from "vitest";
import {
  REGIONS,
  STRUCTURES,
  UNITS,
  REGION_BY_KEY,
  STRUCTURE_BY_KEY,
  UNIT_BY_KEY,
  structuresForRegion,
  DEFAULT_GAME_CONFIG,
} from "../src/index.js";

describe("reference data integrity", () => {
  it("has the 8 source region types", () => {
    expect(REGIONS).toHaveLength(8);
    expect(REGION_BY_KEY.get("technology")?.cost).toBe(3000);
    expect(REGION_BY_KEY.get("mountain")?.income).toEqual({ fuel: 5, food: 5 });
  });

  it("has unique keys across all reference tables", () => {
    const dupes = (keys: string[]) =>
      keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes(REGIONS.map((r) => r.key))).toEqual([]);
    expect(dupes(STRUCTURES.map((s) => s.key))).toEqual([]);
    expect(dupes(UNITS.map((u) => u.key))).toEqual([]);
  });

  it("every structure builds on a real region or has prereqs", () => {
    for (const s of STRUCTURES) {
      if (s.buildsOn) expect(REGION_BY_KEY.has(s.buildsOn)).toBe(true);
      else expect(s.prereq).toBeDefined();
    }
  });

  it("every structure prereq references real structures & units", () => {
    for (const s of STRUCTURES) {
      for (const dep of s.prereq?.structures ?? []) {
        expect(STRUCTURE_BY_KEY.has(dep)).toBe(true);
      }
      for (const dep of s.prereq?.units ?? []) {
        expect(UNIT_BY_KEY.has(dep)).toBe(true);
      }
    }
  });

  it("every unit prereq references a real structure", () => {
    for (const u of UNITS) {
      for (const dep of u.prereq?.structures ?? []) {
        expect(STRUCTURE_BY_KEY.has(dep)).toBe(true);
      }
    }
  });

  it("promotes Ore/Steel to real produced resources", () => {
    expect(STRUCTURE_BY_KEY.get("ironOreMine")?.produces).toEqual({ ore: 50 });
    expect(STRUCTURE_BY_KEY.get("steelWorks")?.produces).toEqual({ steel: 100 });
  });

  it("shipyard requires industrial regions plus ore & steel", () => {
    const shipyard = STRUCTURE_BY_KEY.get("shipyard");
    expect(shipyard?.prereq?.regions).toEqual({ industrial: 8 });
    expect(shipyard?.prereq?.resources).toEqual({ ore: 5, steel: 5 });
  });

  it("structuresForRegion returns desert power structures", () => {
    const keys = structuresForRegion("desert").map((s) => s.key);
    expect(keys).toContain("windmill");
    expect(keys).toContain("solarPowerPlant");
  });

  it("carries the source game config", () => {
    expect(DEFAULT_GAME_CONFIG.turnsPerDay).toBe(8);
    expect(DEFAULT_GAME_CONFIG.maxPlayers).toBe(20);
  });
});

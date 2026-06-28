import type { StructureType } from "../types.js";

/**
 * Structure reference data (authoritative balance values).
 *
 * Note: in the 2002 sheet, Iron Ore Mine / Steel Works recorded output in the Coins
 * column. Per the modern design they are promoted to produce real Ore/Steel,
 * which the build tree already requires (Shipyard needs 5 Ore, 5 Steel).
 */
export const STRUCTURES: readonly StructureType[] = [
  // ── Economic (R) ──────────────────────────────────────────────────────────
  {
    key: "windmill",
    name: "Windmill",
    class: "R",
    buildsOn: "desert",
    cost: { gold: 200 },
    produces: { fuel: 10 },
    upkeep: { gold: 5 },
  },
  {
    key: "powerPlant",
    name: "Power Plant",
    class: "R",
    buildsOn: "river",
    cost: { gold: 500 },
    produces: { fuel: 25 },
    upkeep: { gold: 10 },
  },
  {
    key: "solarPowerPlant",
    name: "Solar Power Plant",
    class: "R",
    buildsOn: "desert",
    cost: { gold: 1000 },
    produces: { fuel: 50 },
    upkeep: { gold: 20 },
  },
  {
    key: "tidalPowerPlant",
    name: "Tidal Power Plant",
    class: "R",
    buildsOn: "coastal",
    cost: { gold: 2000 },
    produces: { fuel: 100 },
    upkeep: { gold: 40 },
  },
  {
    key: "ironOreMine",
    name: "Iron Ore Mine",
    class: "R",
    buildsOn: "mountain",
    cost: { gold: 500 },
    produces: { ore: 50 }, // sheet recorded as gold; promoted to Ore per modern design
    upkeep: { fuel: 20 },
  },
  {
    key: "steelWorks",
    name: "Steel Works",
    class: "R",
    buildsOn: "mountain",
    cost: { gold: 500 },
    produces: { steel: 100 }, // sheet recorded as gold; promoted to Steel
    upkeep: { fuel: 40 },
  },
  {
    key: "farm",
    name: "Farm",
    class: "R",
    buildsOn: "agricultural",
    cost: { gold: 100 },
    produces: { food: 100 },
    upkeep: { gold: 40 },
  },
  {
    key: "ranch",
    name: "Ranch",
    class: "R",
    buildsOn: "agricultural",
    cost: { gold: 100 },
    produces: { fuel: 50, food: 50 },
    upkeep: { gold: 50 },
  },
  {
    key: "researchFacility",
    name: "Research Facility",
    class: "R",
    buildsOn: "technology",
    cost: { gold: 1000 },
    produces: {}, // produces Research Points → tech ladder; value TBD in balancing
    note: "Produces Research Points toward the tech milestone ladder.",
  },

  // ── Military (M): structures, defenses, and unlocks ───────────────────────
  {
    key: "barracks",
    name: "Barracks",
    class: "M",
    prereq: { regions: { urban: 5 } },
    cost: { gold: 100 },
    upkeep: { fuel: 10, gold: 20 },
    unlocks: ["lightInfantry", "heavyInfantry", "rocketLauncher", "gunTurret"],
  },
  {
    key: "shipyard",
    name: "Shipyard",
    class: "M",
    prereq: { regions: { industrial: 8 }, resources: { ore: 5, steel: 5 } },
    cost: { gold: 1000 },
    upkeep: { fuel: 50, gold: 100 },
    unlocks: ["carrier", "battleTank", "battleCopter", "fighterJet"],
  },
  {
    key: "battleAcademy",
    name: "Battle Academy",
    class: "M",
    prereq: { regions: { urban: 20 }, structures: ["researchFacility"] },
    cost: { gold: 10000 },
    upkeep: { fuel: 50, gold: 250 },
    unlocks: ["commander", "missileBase", "defenseSatellite"],
    note: "Source prereq '5 Research' modeled as requiring a Research Facility.",
  },
  {
    key: "commandCenter",
    name: "Command Center",
    class: "M",
    prereq: { units: ["commander"] }, // source: requires a Commander (a unit, not a structure)
    cost: { gold: 20000 },
    upkeep: { fuel: 50, gold: 100 },
    unlocks: ["covertAgent"],
  },
  {
    key: "gunTurret",
    name: "Gun Turret",
    class: "M",
    prereq: { structures: ["barracks"] },
    cost: { gold: 100 },
    upkeep: { fuel: 5, gold: 5 },
    defense: 4,
    note: "Static ground defense (built ×10).",
  },
  {
    key: "missileBase",
    name: "Missile Base",
    class: "M",
    prereq: { structures: ["barracks", "battleAcademy"] },
    cost: { gold: 1500 },
    upkeep: { fuel: 10, gold: 20 },
    defense: 25,
    note: "Mid-tier defense (built ×5).",
  },
  {
    key: "reconSatellite",
    name: "Recon Satellite",
    class: "M",
    prereq: { structures: ["researchFacility"] },
    requiresTech: "orbitalEngineering",
    cost: { gold: 6000 },
    upkeep: { fuel: 20, gold: 20 },
    note: "Civilian orbital surveillance — reveals rival region types & structures. Research-path payload (no Battle Academy); needs Orbital Engineering.",
  },
  {
    key: "defenseSatellite",
    name: "Defense Satellite",
    class: "M",
    prereq: { structures: ["barracks", "battleAcademy"] },
    requiresTech: "orbitalEngineering",
    cost: { gold: 20000 },
    upkeep: { fuel: 50, gold: 50 },
    defense: 120,
    note: "Uncrewed orbital defense (missile-lofted); counters WMD/orbital strikes — and doubles as recon. Needs Orbital Engineering.",
  },

  // ── Capstone: the space program (Tier-I → Tier-II gate) ───────────────────
  {
    key: "spaceport",
    name: "Spaceport",
    class: "R",
    buildsOn: "technology",
    requiresTech: "interplanetaryDrive",
    prereq: { regions: { technology: 3 }, structures: ["researchFacility", "shipyard"] },
    cost: { gold: 30000, steel: 50, fuel: 200 },
    upkeep: { fuel: 50, gold: 100 }, // fuel-then-credits, matching other structures
    note: "Launches your first CREWED interplanetary vehicle (colony ship) — the gateway to the Solar System tier: colony transport, off-world mining, new worlds. Requires a real research-industrial base (3 Technology regions, a Research Facility, a Shipyard) + Interplanetary Drive. Future content.",
  },
] as const;

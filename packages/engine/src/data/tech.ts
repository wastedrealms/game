import type { TechMilestone } from "../types.js";

/**
 * The research ladder — a short chain of milestones, NOT a sprawling web
 * (a deliberate design guardrail). Each rung
 * requires the previous one and a Research-Point total. Tiers IV+ gate the
 * future System/Galaxy boards; for now they still serve as the long-game
 * tech-victory targets.
 *
 * RP costs ramp so research is a real long-term commitment (tune in balancing).
 */
export const TECHS: readonly TechMilestone[] = [
  {
    key: "industrialLogistics",
    name: "Industrial Logistics",
    tier: 1,
    rpCost: 200,
    note: "+10% output from economic structures.",
  },
  {
    key: "advancedMaterials",
    name: "Advanced Materials",
    tier: 2,
    rpCost: 500,
    requires: "industrialLogistics",
    note: "+25% Ore & Steel yield.",
  },
  {
    key: "orbitalEngineering",
    name: "Orbital Engineering",
    tier: 3,
    rpCost: 1000,
    requires: "advancedMaterials",
    note: "Unlocks Carriers & Defense Satellites (uncrewed orbital defense).",
  },
  {
    key: "interplanetaryDrive",
    name: "Interplanetary Drive",
    tier: 4,
    rpCost: 2000,
    requires: "orbitalEngineering",
    note: "Crewed colony ships + the Spaceport — readies the Solar System tier (future).",
  },
  {
    key: "terraforming",
    name: "Terraforming",
    tier: 5,
    rpCost: 3500,
    requires: "interplanetaryDrive",
    note: "Colonise hostile worlds & new biomes (future).",
  },
  {
    key: "jumpGateTheory",
    name: "Jump Gate Theory",
    tier: 6,
    rpCost: 6000,
    requires: "terraforming",
    note: "System-to-system travel — readies the Galaxy tier (future).",
  },
  {
    key: "singularity",
    name: "Singularity",
    tier: 7,
    rpCost: 10000,
    requires: "jumpGateTheory",
    note: "The endgame breakthrough — triggers a tech victory.",
  },
] as const;

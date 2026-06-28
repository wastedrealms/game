// Per-structure / per-unit lucide icons. Names verified against lucide-react@0.460.0
// (some expected names don't exist — e.g. Windmill/Helicopter/Tank/Drone — so these
// use the closest available glyph). See task #42 / docs balance review.
import {
  Wind,
  Zap,
  Sun,
  Waves,
  Pickaxe,
  Factory,
  Wheat,
  Beef,
  FlaskConical,
  Tent,
  Anchor,
  GraduationCap,
  Network,
  Crosshair,
  Bomb,
  Satellite,
  ShieldCheck,
  Orbit,
  PersonStanding,
  Shield,
  Rocket,
  VenetianMask,
  Crown,
  Ship,
  Truck,
  Fan,
  Plane,
  Box,
  type LucideIcon,
} from "lucide-react";

export const STRUCTURE_ICON: Record<string, LucideIcon> = {
  windmill: Wind,
  powerPlant: Zap,
  solarPowerPlant: Sun,
  tidalPowerPlant: Waves,
  ironOreMine: Pickaxe,
  steelWorks: Factory,
  farm: Wheat,
  ranch: Beef,
  researchFacility: FlaskConical,
  barracks: Tent,
  shipyard: Anchor,
  battleAcademy: GraduationCap,
  commandCenter: Network,
  gunTurret: Crosshair,
  missileBase: Bomb,
  reconSatellite: Satellite,
  defenseSatellite: ShieldCheck,
  spaceport: Orbit,
};

export const UNIT_ICON: Record<string, LucideIcon> = {
  lightInfantry: PersonStanding,
  heavyInfantry: Shield,
  rocketLauncher: Rocket,
  covertAgent: VenetianMask,
  commander: Crown,
  carrier: Ship,
  battleTank: Truck,
  battleCopter: Fan,
  fighterJet: Plane,
};

/** Icon for a structure/unit key, with a neutral fallback. */
export const structureIcon = (key: string): LucideIcon => STRUCTURE_ICON[key] ?? Box;
export const unitIcon = (key: string): LucideIcon => UNIT_ICON[key] ?? Box;

import type { RegionKey } from "@wasted-realms/engine";

/** Map colors per region type — used by the hex map and legend. */
export const REGION_COLOR: Record<RegionKey, string> = {
  coastal: "#2bb3c0",
  river: "#3b82f6",
  agricultural: "#6fcf5f",
  desert: "#d9b25f",
  industrial: "#8a8f98",
  urban: "#a78bfa",
  mountain: "#b08968",
  technology: "#ffb000",
};

/** Two-letter abbreviation shown inside a hex. */
export const REGION_ABBR: Record<RegionKey, string> = {
  coastal: "Co",
  river: "Ri",
  agricultural: "Ag",
  desert: "De",
  industrial: "In",
  urban: "Ur",
  mountain: "Mt",
  technology: "Te",
};

/**
 * Hex geometry for the empire map. Regions are laid out in a deterministic
 * outward spiral keyed by their index in `empire.regions`. Because land is only
 * ever appended (buy/capture) or removed from the end (capture splices the tail),
 * a region's index — and therefore its coordinate and neighbours — is stable.
 * Shared by the engine (adjacency synergies) and the UI (rendering).
 */

export interface Axial {
  q: number;
  r: number;
}

const AX_DIRS: Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Axial coordinate of the i-th cell in the outward spiral (i=0 is the centre). */
export function spiralAxial(index: number): Axial {
  if (index <= 0) return { q: 0, r: 0 };
  let ring = 1;
  for (;;) {
    const start = 1 + 3 * ring * (ring - 1); // first index belonging to this ring
    const count = 6 * ring;
    if (index < start + count) {
      const within = index - start;
      const side = Math.floor(within / ring);
      const step = within % ring;
      // start of the ring, then walk full sides, then the remaining steps
      let cube: Axial = { q: AX_DIRS[4].q * ring, r: AX_DIRS[4].r * ring };
      for (let s = 0; s < side; s++) {
        cube = { q: cube.q + AX_DIRS[s].q * ring, r: cube.r + AX_DIRS[s].r * ring };
      }
      cube = { q: cube.q + AX_DIRS[side].q * step, r: cube.r + AX_DIRS[side].r * step };
      return cube;
    }
    ring++;
  }
}

/** The six neighbouring coordinates of an axial cell. */
export function axialNeighbors(a: Axial): Axial[] {
  return AX_DIRS.map((d) => ({ q: a.q + d.q, r: a.r + d.r }));
}

export function axialKey(a: Axial): string {
  return `${a.q},${a.r}`;
}

/** Convert an axial coordinate to pointy-top pixel space for a given hex size. */
export function axialToPixel(a: Axial, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (a.q + a.r / 2),
    y: size * 1.5 * a.r,
  };
}

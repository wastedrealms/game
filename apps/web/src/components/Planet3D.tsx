import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { Planet } from "@wasted-realms/engine";
import { getStructureIconCanvas } from "../ui/iconBitmaps";

const R = 2; // planet radius
const TEX_W = 384;
const TEX_H = 192;
// Selected-tile marker colour — a bright cyan the territory palette never uses.
const SELECT_COLOR = "#7ff0ff";

// One CanvasTexture per structure key (shared by all sprites of that type), built
// from the same cached glyph canvas the 2D map uses so markers match across views.
const spriteTexCache = new Map<string, THREE.CanvasTexture>();
function structureTexture(key: string): THREE.CanvasTexture | null {
  const hit = spriteTexCache.get(key);
  if (hit) return hit;
  const canvas = getStructureIconCanvas(key, { px: 96, color: "#ffe9b0", disc: "rgba(6,9,14,0.82)" });
  if (!canvas) return null;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  spriteTexCache.set(key, tex);
  return tex;
}

/**
 * Swings the camera to face an empire's centroid [x,y,z] and pulls back to the
 * supplied distance focus[3] so the whole empire fits (no clipping).
 */
function FocusController({ focus }: { focus: [number, number, number, number] | null }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  useFrame(() => {
    if (!focus) return;
    const dist = focus[3] ?? camera.position.length();
    target.current.set(focus[0], focus[1], focus[2]).normalize().multiplyScalar(dist);
    camera.position.lerp(target.current, 0.12);
    // Match the 2D map's up-vector rule (HexMap.tsx): near a pole the centroid is
    // ~(0,±1,0), where the default up makes lookAt degenerate (arbitrary roll). The
    // player's realm is always seeded on the +Y pole, so without this the Planet and
    // Map disagree on orientation by ~180°.
    const polar = Math.abs(focus[1]) >= 0.95;
    camera.up.set(polar ? 1 : 0, polar ? 0 : 1, 0);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Map every texel of an equirectangular image to its NEAREST tile (a spherical
 * Voronoi diagram). This is the expensive pass, so it's cached per planet; the
 * coloured texture (and selection highlight) is then a cheap recolour of it.
 */
function usePlanetCells(planet: Planet): Uint16Array {
  return useMemo(() => {
    const cells = new Uint16Array(TEX_W * TEX_H);
    const px = planet.pos;
    // Use THREE.SphereGeometry's EXACT uv→position convention so the baked texture
    // aligns with the geometry (otherwise the colours land at the wrong longitude/
    // latitude — invisible at the poles, badly offset on the equator). For a
    // DataTexture (flipY = false) image row `v` maps to uv.y = (v+0.5)/TEX_H, and
    // SphereGeometry sets uv.y = 1 − phi/π, so phi = π·(1 − uv.y). Azimuth follows
    // x = −cos(2πu)·sinφ, y = cosφ, z = sin(2πu)·sinφ.
    for (let v = 0; v < TEX_H; v++) {
      const phi = Math.PI * (1 - (v + 0.5) / TEX_H);
      const sinP = Math.sin(phi);
      const dy = Math.cos(phi);
      for (let u = 0; u < TEX_W; u++) {
        const ang = ((u + 0.5) / TEX_W) * 2 * Math.PI;
        const dx = -Math.cos(ang) * sinP;
        const dz = Math.sin(ang) * sinP;
        let best = 0;
        let bestDot = -Infinity;
        for (let t = 0; t < px.length; t++) {
          const d = px[t][0] * dx + px[t][1] * dy + px[t][2] * dz;
          if (d > bestDot) {
            bestDot = d;
            best = t;
          }
        }
        cells[v * TEX_W + u] = best;
      }
    }
    return cells;
    // Depend on tile POSITIONS only (stable across clonePlanet) so this heavy
    // Voronoi pass runs once per game, not on every claim/build/turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planet.pos]);
}

/**
 * Bake the Voronoi cells into a texture (each cell = its tile's colour → contiguous
 * AREAS). The selection is NOT baked here — at the poles (where a compact empire can
 * sit) the equirectangular texels pinch to the pole singularity, so a baked cell can
 * become an invisible sliver. Selection is drawn as a separate 3D marker instead.
 */
function usePlanetTexture(cells: Uint16Array, tileColors: string[]): THREE.DataTexture {
  return useMemo(() => {
    const rgb = tileColors.map(hexToRgb);
    const data = new Uint8Array(TEX_W * TEX_H * 4);
    for (let i = 0; i < cells.length; i++) {
      const c = rgb[cells[i]] ?? [40, 48, 60];
      const o = i * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, TEX_W, TEX_H, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [cells, tileColors]);
}

/**
 * Build a transparent "mask" texture that is bright cyan ONLY on the selected tile's
 * Voronoi cell (alpha 0 everywhere else). Because it reuses the same `cells` map and
 * UV convention as the planet texture, it covers the EXACT region shape/border — not
 * an approximating circle. A new texture per selection so the GPU actually picks it up.
 */
function useSelectionMask(cells: Uint16Array, selectedTile: number | null): THREE.DataTexture | null {
  return useMemo(() => {
    if (selectedTile === null) return null;
    const [r, g, b] = hexToRgb(SELECT_COLOR);
    const data = new Uint8Array(TEX_W * TEX_H * 4);
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === selectedTile) {
        const o = i * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, TEX_W, TEX_H, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [cells, selectedTile]);
}

/**
 * Overlay sphere that paints the selection mask just above the surface — so the actual
 * region area (its real Voronoi border) glows, matching the 2D map. The pulse is driven
 * by material OPACITY (a per-frame uniform, which updates reliably) rather than by
 * re-uploading texture pixels (which does not).
 */
function SelectionMask({
  cells,
  selectedTile,
}: {
  cells: Uint16Array;
  selectedTile: number | null;
}) {
  const mask = useSelectionMask(cells, selectedTile);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matRef = useRef<any>(null);
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.opacity = 0.5 + 0.3 * Math.abs(Math.sin(clock.elapsedTime * 4));
  });
  if (!mask) return null;
  return (
    <mesh renderOrder={10}>
      <sphereGeometry args={[R * 1.003, 96, 96]} />
      {/* key on the mask uuid so a new selection's texture reaches the GPU. */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <meshBasicMaterial
        key={mask.uuid}
        ref={matRef}
        map={mask as any}
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Find the tile nearest to a world-space point on the sphere. */
function nearestTile(planet: Planet, x: number, y: number, z: number): number {
  const len = Math.hypot(x, y, z) || 1;
  const dx = x / len;
  const dy = y / len;
  const dz = z / len;
  let best = 0;
  let bestDot = -Infinity;
  for (let t = 0; t < planet.pos.length; t++) {
    const dot = planet.pos[t][0] * dx + planet.pos[t][1] * dy + planet.pos[t][2] * dz;
    if (dot > bestDot) {
      bestDot = dot;
      best = t;
    }
  }
  return best;
}

export default function Planet3D({
  planet,
  tileColors,
  selectedTile,
  onSelect,
  focus,
  onInteract,
  markerTiles = [],
}: {
  planet: Planet;
  tileColors: string[];
  selectedTile: number | null;
  onSelect: (tile: number) => void;
  focus: [number, number, number, number] | null;
  /** Called when the user grabs the controls (rotate/zoom) — releases any focus lock. */
  onInteract?: () => void;
  /** Tile indices that should show a structure marker (already fog-of-war filtered). */
  markerTiles?: number[];
}) {
  const cells = usePlanetCells(planet);
  const texture = usePlanetTexture(cells, tileColors);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(nearestTile(planet, e.point.x, e.point.y, e.point.z));
  };

  const markerPos = (i: number, s: number): [number, number, number] => [
    planet.pos[i][0] * R * s,
    planet.pos[i][1] * R * s,
    planet.pos[i][2] * R * s,
  ];

  return (
    <Canvas
      aria-label="Planet globe — click a region to select it"
      camera={{ position: [0, 0, 5.5], fov: 45 }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ height: "100%", width: "100%" }}
    >
      <color attach="background" args={["#05070b"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[5, 3, 5]} intensity={0.9} />
      <Stars radius={50} depth={30} count={1500} factor={3} fade speed={0.5} />

      {/* The planet surface — Voronoi-filled contiguous territory areas. */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[R, 96, 96]} />
        {/* key on the texture's uuid so the material adopts EVERY freshly-baked
            texture — on selection AND on claim/build/turn. A new texture object is
            the only thing that reliably reaches the GPU here. */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <meshStandardMaterial key={texture.uuid} map={texture as any} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.13, 32, 32]} />
        <meshBasicMaterial color="#1c6f8c" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>

      {/* Structure markers — billboarded lucide glyphs just above the surface.
          depthTest lets the opaque globe occlude markers on the far hemisphere. */}
      {markerTiles.map((i) => {
        const key = planet.structure[i];
        const tex = key ? structureTexture(key) : null;
        if (!tex) return null;
        return (
          <sprite key={i} position={markerPos(i, 1.02)} scale={[0.1, 0.1, 0.1]}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <spriteMaterial map={tex as any} transparent depthWrite={false} />
          </sprite>
        );
      })}
      <SelectionMask cells={cells} selectedTile={selectedTile} />
      <FocusController focus={focus} />

      <OrbitControls
        enablePan={false}
        minDistance={3.2}
        maxDistance={9}
        autoRotate={focus === null && selectedTile === null}
        autoRotateSpeed={0.45}
        onStart={onInteract}
        mouseButtons={{
          LEFT: undefined as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
      />
    </Canvas>
  );
}

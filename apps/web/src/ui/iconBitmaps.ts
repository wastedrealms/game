// Shared structure-icon → cached <canvas> rasteriser, used by BOTH the 2D map
// (ctx.drawImage) and the 3D planet (THREE.CanvasTexture on a sprite) so markers
// look identical in both. We render the (already-imported) lucide component to an
// SVG string, parse it, and stroke every element type onto a canvas — lucide icons
// use circle/line/rect/polyline as well as path, so a path-only approach would drop
// parts of several icons. Each (key, size, color, disc) variant is memoised.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { structureIcon } from "./itemIcons";

const cache = new Map<string, HTMLCanvasElement>();

interface IconOpts {
  px?: number;
  color?: string;
  /** Backing disc fill (for contrast over busy terrain); omit for none. */
  disc?: string;
  strokeWidth?: number;
}

/** Draw one parsed SVG element onto the (already transformed) 2D context. */
function strokeEl(ctx: CanvasRenderingContext2D, el: Element): void {
  const n = (a: string) => parseFloat(el.getAttribute(a) || "0");
  switch (el.tagName.toLowerCase()) {
    case "path": {
      const d = el.getAttribute("d");
      if (d) ctx.stroke(new Path2D(d));
      break;
    }
    case "circle":
      ctx.beginPath();
      ctx.arc(n("cx"), n("cy"), n("r"), 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(n("cx"), n("cy"), n("rx"), n("ry"), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "line":
      ctx.beginPath();
      ctx.moveTo(n("x1"), n("y1"));
      ctx.lineTo(n("x2"), n("y2"));
      ctx.stroke();
      break;
    case "rect": {
      const x = n("x"), y = n("y"), w = n("width"), h = n("height"), r = n("rx");
      ctx.beginPath();
      if (r && typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
      ctx.stroke();
      break;
    }
    case "polyline":
    case "polygon": {
      const pts = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
      ctx.beginPath();
      for (let i = 0; i + 1 < pts.length; i += 2) {
        if (i === 0) ctx.moveTo(pts[i], pts[i + 1]);
        else ctx.lineTo(pts[i], pts[i + 1]);
      }
      if (el.tagName.toLowerCase() === "polygon") ctx.closePath();
      ctx.stroke();
      break;
    }
  }
}

/**
 * A cached square canvas with the structure's lucide glyph (optionally over a
 * backing disc). Returns null in non-DOM environments. lucide viewBox is 24×24.
 */
export function getStructureIconCanvas(
  key: string,
  opts: IconOpts = {},
): HTMLCanvasElement | null {
  const px = opts.px ?? 64;
  const color = opts.color ?? "#ffe9b0";
  const disc = opts.disc ?? "";
  const sw = opts.strokeWidth ?? 2.25;
  const ck = `${key}|${px}|${color}|${disc}|${sw}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (disc) {
    ctx.beginPath();
    ctx.arc(px / 2, px / 2, (px / 2) * 0.94, 0, Math.PI * 2);
    ctx.fillStyle = disc;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = Math.max(1, px * 0.03);
    ctx.stroke();
  }

  const Icon = structureIcon(key);
  const svg = renderToStaticMarkup(createElement(Icon, { color, strokeWidth: sw }));
  const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;

  const pad = px * 0.26; // leave room inside the disc
  const scale = (px - pad * 2) / 24;
  ctx.save();
  ctx.translate(pad, pad);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = sw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const el of Array.from(root.children)) strokeEl(ctx, el);
  ctx.restore();

  cache.set(ck, canvas);
  return canvas;
}

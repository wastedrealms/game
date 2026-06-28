import {
  Coins,
  Wheat,
  Fuel,
  Pickaxe,
  Hammer,
  type LucideIcon,
} from "lucide-react";
import type { Resource, ResourceBag } from "@wasted-realms/engine";

export const RES_META: Record<
  Resource,
  { label: string; Icon: LucideIcon; cls: string }
> = {
  // Internal resource key stays `gold` (engine-wide); player-facing name is Credits.
  gold: { label: "Credits", Icon: Coins, cls: "text-[var(--color-gold)]" },
  food: { label: "Food", Icon: Wheat, cls: "text-[var(--color-food)]" },
  fuel: { label: "Fuel", Icon: Fuel, cls: "text-[var(--color-fuel)]" },
  ore: { label: "Ore", Icon: Pickaxe, cls: "text-[var(--color-ore)]" },
  steel: { label: "Steel", Icon: Hammer, cls: "text-[var(--color-steel)]" },
};

export const RES_ORDER: Resource[] = ["gold", "food", "fuel", "ore", "steel"];

export function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Render a resource bag as a row of icon+amount chips. */
export function Bag({
  bag,
  sign,
}: {
  bag?: ResourceBag;
  sign?: "+" | "-";
}) {
  const entries = bag
    ? (Object.keys(bag) as Resource[]).filter((k) => (bag[k] ?? 0) !== 0)
    : [];
  if (entries.length === 0) return <span className="opacity-30">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
      {entries.map((k) => {
        const { Icon, cls, label } = RES_META[k];
        return (
          <span
            key={k}
            className="inline-flex items-center gap-1 font-display text-sm"
            title={label}
          >
            <Icon className={`h-3.5 w-3.5 ${cls}`} strokeWidth={2.25} />
            <span className="tabular-nums">
              {sign ?? ""}
              {fmt(bag![k] ?? 0)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

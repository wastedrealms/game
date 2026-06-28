import {
  REGION_BY_KEY,
  STRUCTURE_BY_KEY,
  structuresForRegion,
  canBuildStructure,
  SYNERGIES,
  type Action,
  type GameState,
  type OwnedRegion,
} from "@wasted-realms/engine";
import { Plus, Eye, Zap } from "lucide-react";
import { structureIcon } from "../ui/itemIcons";
import { Bag } from "../ui/resources";
import { REGION_COLOR } from "../ui/regionColors";

/** Region inspector + build-on-region actions. Shared by the 2D map and 3D planet. */
export function RegionDetail({
  region,
  game,
  playerId,
  dispatch,
  owned,
}: {
  region: OwnedRegion;
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
  owned: boolean;
}) {
  const e = game.empires[playerId];
  const def = REGION_BY_KEY.get(region.type);
  const options = structuresForRegion(region.type);

  // How many adjacent owned tiles a structure here would boost (planet adjacency).
  const synergyHint = (structureKey: string): string | null => {
    if (region.tile === undefined) return null;
    const rules = SYNERGIES.filter((r) => r.sourceStructure === structureKey);
    if (rules.length === 0) return null;
    const byTile = new Map(
      e.regions.filter((r) => r.tile !== undefined).map((r) => [r.tile, r] as const),
    );
    const parts: string[] = [];
    for (const rule of rules) {
      let n = 0;
      for (const nb of game.planet.neighbors[region.tile] ?? []) {
        const t = byTile.get(nb);
        if (t && t.type === rule.targetRegion) n++;
      }
      if (n > 0) parts.push(`+${Math.round(rule.pct * 100)}% ${rule.resource} ×${n} ${rule.targetRegion}`);
    }
    return parts.length ? parts.join(" · ") : null;
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: REGION_COLOR[region.type] }}
        />
        <h3 className="font-display text-sm font-bold">{def?.name}</h3>
      </div>
      <p className="mt-1 font-display text-xs opacity-50">{def?.note}</p>
      <div className="mt-2 font-display text-xs">
        Income: <Bag bag={def?.income} sign="+" />
      </div>

      <div className="mt-3 font-display text-xs font-semibold uppercase tracking-wide opacity-70">
        Structure
      </div>
      {region.structure ? (
        (() => {
          const def = STRUCTURE_BY_KEY.get(region.structure);
          const Icon = structureIcon(region.structure);
          return (
            <div className="mt-1 space-y-1 font-display text-sm">
              <p className="inline-flex items-center gap-1.5 font-medium">
                <Icon className="h-4 w-4 text-[var(--color-accent)]" />
                {def?.name}
              </p>
              <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
                <span className="uppercase tracking-wide opacity-40">Yield</span>
                <Bag bag={def?.produces ?? {}} sign="+" />
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
                <span className="uppercase tracking-wide opacity-40">Upkeep</span>
                <Bag bag={def?.upkeep ?? {}} sign="-" />
              </div>
            </div>
          );
        })()
      ) : !owned ? (
        <p className="mt-1 font-display text-sm opacity-40">Undeveloped.</p>
      ) : options.length === 0 ? (
        <p className="mt-1 font-display text-sm opacity-40">Nothing buildable here.</p>
      ) : (
        <ul className="mt-1 space-y-2">
          {options.map((s) => {
            const check = canBuildStructure(e, s.key);
            const hint = synergyHint(s.key);
            const Icon = structureIcon(s.key);
            return (
              <li
                key={s.key}
                className="relative overflow-hidden rounded-md border border-stone-200 bg-white/40 p-2 dark:border-[var(--color-edge)] dark:bg-white/[0.02]"
              >
                {/* Economic accent rail — mirrors Build → Structures */}
                <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-emerald-500/60" />

                {/* Line 1 — identity + price */}
                <div className="flex items-start gap-1.5 pl-1.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 font-display text-sm font-medium leading-tight">
                    {s.name}
                  </span>
                  <span className="shrink-0">
                    <Bag bag={s.cost} sign="-" />
                  </span>
                </div>

                {/* Line 2 — what it yields + the action */}
                <div className="mt-1.5 flex items-end justify-between gap-2 pl-1.5">
                  <dl className="min-w-0 space-y-0.5 font-display text-xs">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <dt className="uppercase tracking-wide opacity-40">Yield</dt>
                      <dd><Bag bag={s.produces} sign="+" /></dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <dt className="uppercase tracking-wide opacity-40">Upkeep</dt>
                      <dd><Bag bag={s.upkeep} sign="-" /></dd>
                    </div>
                  </dl>
                  <button
                    onClick={() =>
                      dispatch({
                        kind: "BUILD_STRUCTURE",
                        structureKey: s.key,
                        regionId: region.id,
                      })
                    }
                    disabled={!check.ok}
                    title={check.reason}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-stone-300 px-2 py-1 font-display text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-30 dark:border-[var(--color-edge)]"
                  >
                    <Plus className="h-3 w-3" strokeWidth={2.5} />
                    Build
                  </button>
                </div>

                {/* Synergy — key adjacency decision, set apart by a hairline */}
                {hint && (
                  <p className="mt-1.5 flex items-start gap-1 border-t border-stone-200/60 pl-1.5 pt-1.5 font-display text-[11px] text-[var(--color-accent)] dark:border-[var(--color-edge)]">
                    <Zap className="mt-0.5 h-3 w-3 shrink-0" />
                    <span><span className="opacity-70">Synergy</span> {hint}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!owned && (
        <p className="mt-3 inline-flex items-center gap-1 font-display text-[11px] text-[var(--color-accent)]">
          <Eye className="h-3 w-3" /> reconnaissance view
        </p>
      )}
    </div>
  );
}

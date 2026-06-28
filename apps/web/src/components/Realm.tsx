import {
  REGION_BY_KEY,
  STRUCTURE_BY_KEY,
  UNIT_BY_KEY,
  supportMult,
  taxIncome,
  offensivePower,
  defensivePower,
  landShare,
  frontierTiles,
  victoryObjective,
  type Action,
  type GameState,
  type VictoryStatus,
  type RegionKey,
} from "@wasted-realms/engine";
import type { CSSProperties } from "react";
import { Globe2, Swords, Landmark, Shield, Coins, Gauge, Target } from "lucide-react";
import { REGION_COLOR } from "../ui/regionColors";

export function Realm({
  game,
  playerId,
  dispatch,
  victory,
}: {
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
  victory: VictoryStatus;
}) {
  const e = game.empires[playerId];

  return (
    // Objective first (full width), then Policy 50/50, then Territory + Forces.
    <section className="wr-boot grid gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 dark:border-[var(--color-edge)] dark:bg-[var(--color-edge)] lg:grid-cols-2">
      <Objective game={game} playerId={playerId} victory={victory} />
      <Policy e={e} config={game.config} dispatch={dispatch} />
      <Territory e={e} game={game} playerId={playerId} />
      <Forces e={e} />
    </section>
  );
}

/* ── Objective ──────────────────────────────────────────────────────── */
function Objective({
  game,
  playerId,
  victory,
}: {
  game: GameState;
  playerId: string;
  victory: VictoryStatus;
}) {
  const cfg = game.config.victory;
  // Player's tier of play, derived from tech progress (Planet → System → Galaxy).
  const tech = game.empires[playerId]?.tech ?? [];
  const tier = tech.includes("jumpGateTheory")
    ? "Galaxy Tier"
    : tech.includes("interplanetaryDrive")
      ? "System Tier"
      : "Planet Tier";
  return (
    <div className="bg-white/70 p-4 dark:bg-[var(--color-panel)] lg:col-span-2">
      <Header icon={Target} label="Objective">
        <span className="capitalize opacity-50">
          {tier} · {cfg.length} game
        </span>
        <span className="opacity-50">
          {" "}
          · turn {victory.gameTurn}/{victory.turnDeadline}
        </span>
      </Header>
      <p className="mt-2 font-display text-sm">{victoryObjective(cfg)}</p>
    </div>
  );
}

/* ── Territory ──────────────────────────────────────────────────────── */
function Territory({
  e,
  game,
  playerId,
}: {
  e: GameState["empires"][string];
  game: GameState;
  playerId: string;
}) {
  const byType = new Map<RegionKey, { count: number; built: number }>();
  for (const r of e.regions) {
    const g = byType.get(r.type) ?? { count: 0, built: 0 };
    g.count++;
    if (r.structure) g.built++;
    byType.set(r.type, g);
  }
  const types = [...byType.entries()].sort((a, b) => b[1].count - a[1].count);
  const total = e.regions.length || 1;
  const developed = e.regions.filter((r) => r.structure).length;
  const share = Math.round(landShare(game.planet, playerId) * 100);
  const frontier = frontierTiles(game.planet, playerId).length;

  return (
    <div className="bg-white/70 p-4 dark:bg-[var(--color-panel)]">
      <Header icon={Globe2} label="Territory">
        <span className="tabular-nums">{e.regions.length}</span>
        <span className="opacity-50"> regions</span>
      </Header>

      {e.regions.length === 0 ? (
        <p className="mt-2 font-display text-[13px] leading-snug opacity-55">
          No territory yet. Open the <span className="text-[var(--color-accent)]">Planet</span> or{" "}
          <span className="text-[var(--color-accent)]">Map</span> tab and claim a frontier tile.
        </p>
      ) : (
        <>
          {/* Composition bar — land makeup by terrain, at a glance. */}
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-black/20">
            {types.map(([type, g]) => (
              <div
                key={type}
                title={`${REGION_BY_KEY.get(type)?.name ?? type}: ${g.count}`}
                style={{ width: `${(g.count / total) * 100}%`, background: REGION_COLOR[type] }}
              />
            ))}
          </div>

          {/* Type chips — count + how many are developed. */}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {types.map(([type, g]) => (
              <div key={type} className="flex items-baseline gap-2 font-display text-sm">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: REGION_COLOR[type] }}
                />
                <span className="flex-1 truncate">{REGION_BY_KEY.get(type)?.name ?? type}</span>
                <span className="shrink-0 tabular-nums" title={`${g.built} of ${g.count} developed`}>
                  <span className={g.built > 0 ? "text-[var(--color-accent)]" : "opacity-40"}>
                    {g.built}
                  </span>
                  <span className="opacity-40">/{g.count}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <FootStats
        items={[
          { label: "Developed", value: `${developed}/${e.regions.length}` },
          { label: "Land share", value: `${share}%` },
          { label: "Frontier", value: `${frontier}` },
        ]}
      />
    </div>
  );
}

/* ── Forces ─────────────────────────────────────────────────────────── */
function Forces({ e }: { e: GameState["empires"][string] }) {
  const offense = offensivePower(e.units);
  const defense = defensivePower(e);
  const troops = Object.values(e.units).reduce((a, b) => a + b, 0);
  const structures = Object.values(e.militaryStructures).reduce((a, b) => a + b, 0);
  const hasForces = troops > 0 || structures > 0;
  const powTotal = offense + defense || 1;

  return (
    <div className="bg-white/70 p-4 dark:bg-[var(--color-panel)]">
      <Header icon={Swords} label="Forces">
        {hasForces && (
          <>
            <span className="tabular-nums">{troops}</span>
            <span className="opacity-50"> troops</span>
          </>
        )}
      </Header>

      {!hasForces ? (
        <p className="mt-2 font-display text-[13px] leading-snug opacity-55">
          No standing army. Build a <span className="text-[var(--color-accent)]">Barracks</span>{" "}
          (needs 5 urban) in the <span className="text-[var(--color-accent)]">Military</span> tab to
          recruit troops.
        </p>
      ) : (
        <>
          {/* Offense / defense balance bar — mirrors Territory's composition bar. */}
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-black/20">
            <div style={{ width: `${(offense / powTotal) * 100}%` }} className="bg-red-400" title={`Offense ${offense}`} />
            <div style={{ width: `${(defense / powTotal) * 100}%` }} className="bg-[var(--color-fuel)]" title={`Defense ${defense}`} />
          </div>
          <div className="mt-2 flex gap-4 font-display text-sm">
            <span className="inline-flex items-center gap-1.5" title="Total offensive power">
              <Swords className="h-3.5 w-3.5 text-red-400" /> {offense}
            </span>
            <span className="inline-flex items-center gap-1.5" title="Total defensive power">
              <Shield className="h-3.5 w-3.5 text-[var(--color-fuel)]" /> {defense}
            </span>
          </div>

          {/* Unit + structure chips — same 2-col layout as Territory. */}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-display text-sm">
            {Object.entries(e.units).map(([k, n]) => (
              <div key={k} className="flex items-baseline gap-2">
                <Swords className="h-3 w-3 shrink-0 text-red-400/70" />
                <span className="flex-1 truncate opacity-85">{UNIT_BY_KEY.get(k)?.name ?? k}</span>
                <span className="shrink-0 tabular-nums opacity-60">{n}</span>
              </div>
            ))}
            {Object.entries(e.militaryStructures).map(([k, n]) => (
              <div key={k} className="flex items-baseline gap-2">
                <Shield className="h-3 w-3 shrink-0 text-[var(--color-fuel)]/70" />
                <span className="flex-1 truncate opacity-70">{STRUCTURE_BY_KEY.get(k)?.name ?? k}</span>
                <span className="shrink-0 tabular-nums opacity-50">{n}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <FootStats
        items={[
          { label: "Troops", value: `${troops}` },
          { label: "Installations", value: `${structures}` },
          { label: "Power", value: `${offense + defense}` },
        ]}
      />
    </div>
  );
}

/* ── Policy (full-width strip) ──────────────────────────────────────── */
function Policy({
  e,
  config,
  dispatch,
}: {
  e: GameState["empires"][string];
  config: GameState["config"];
  dispatch: (a: Action) => void;
}) {
  const mult = Math.round(supportMult(e, config) * 100);
  const support = Math.round(e.popularSupport);
  const tax = taxIncome(e, config);
  const supportTone =
    support >= 80
      ? "text-[var(--color-food)]"
      : support >= 40
        ? "text-[var(--color-accent)]"
        : "text-red-500";

  // Two real grid cells so the Tax|Effect divider is the SAME gap-px grid line as
  // the Territory|Forces divider below — perfectly aligned, never off by a pixel.
  return (
    <>
      {/* Tax control — left cell */}
      <div className="bg-white/70 p-4 dark:bg-[var(--color-panel)]">
        <Header icon={Landmark} label="Policy" />
        <div className="mt-2 flex items-baseline justify-between font-display text-sm">
          <span className="opacity-60">Tax rate</span>
          <span className="tabular-nums text-[var(--color-accent)]">{e.taxRate}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={e.taxRate}
          onChange={(ev) => dispatch({ kind: "SET_TAX", rate: Number(ev.target.value) })}
          aria-label="Tax rate"
          style={{ "--pct": `${e.taxRate}%` } as CSSProperties}
          className="wr-range mt-1.5 w-full"
        />
        <p className="mt-1 font-display text-[11px] opacity-50">
          Higher tax funds you now but erodes support, which scales all output.
        </p>
      </div>

      {/* Live consequences — right cell, the tradeoff made legible. */}
      <div className="flex flex-col justify-center bg-white/70 p-4 dark:bg-[var(--color-panel)]">
        <Header icon={Gauge} label="Effect" />
        <div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-1">
          <Consequence label="Support" value={`${support}%`} tone={supportTone} />
          <Consequence label="Output" value={`×${mult}%`} tone="opacity-80" />
          <Consequence
            label="Tax / turn"
            value={`+${tax}`}
            tone="text-[var(--color-gold)]"
            Icon={Coins}
          />
        </div>
      </div>
    </>
  );
}

function Consequence({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: string;
  tone: string;
  Icon?: typeof Coins;
}) {
  return (
    <div className="text-right sm:text-left">
      <div className={`inline-flex items-center gap-1 font-display text-lg tabular-nums ${tone}`}>
        {Icon && <Icon className="h-4 w-4" />}
        {value}
      </div>
      <div className="font-display text-[11px] uppercase tracking-wide opacity-50">{label}</div>
    </div>
  );
}

/* ── shared bits ────────────────────────────────────────────────────── */
function FootStats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-200 pt-3 dark:border-[var(--color-edge)]">
      {items.map((s) => (
        <div key={s.label}>
          <div className="font-display text-base tabular-nums">{s.value}</div>
          <div className="font-display text-[10px] uppercase tracking-wide opacity-50">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Header({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Globe2;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-widest opacity-70">
      <Icon className="h-3.5 w-3.5" /> {label}
      {children && <span className="ml-auto normal-case tracking-normal">{children}</span>}
    </h3>
  );
}

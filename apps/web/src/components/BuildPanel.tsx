import { useState } from "react";
import {
  REGIONS,
  STRUCTURES,
  UNITS,
  STRUCTURE_BY_KEY,
  UNIT_BY_KEY,
  TECH_BY_KEY,
  canBuildStructure,
  canBuildUnit,
  type Action,
  type EmpireState,
  type GameState,
  type StructureType,
} from "@wasted-realms/engine";
import { Map, Building2, Swords, Plus, type LucideIcon } from "lucide-react";
import { Bag, fmt } from "../ui/resources";
import { REGION_COLOR } from "../ui/regionColors";
import { structureIcon, unitIcon } from "../ui/itemIcons";

type Sub = "regions" | "structures" | "units";

export function BuildPanel({
  game,
  playerId,
  dispatch,
}: {
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
}) {
  const [sub, setSub] = useState<Sub>("regions");
  const e = game.empires[playerId];
  // How many of a structure you already own (R = built on tiles, M = empire-level).
  const ownedStructures = (key: string, cls: "R" | "M") =>
    cls === "M"
      ? e.militaryStructures[key] ?? 0
      : e.regions.reduce((n, r) => n + (r.structure === key ? 1 : 0), 0);

  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <div className="flex gap-1 border-b border-stone-200 p-2 dark:border-[var(--color-edge)]">
        <SubTab on={sub === "regions"} onClick={() => setSub("regions")} Icon={Map}>
          Regions
        </SubTab>
        <SubTab
          on={sub === "structures"}
          onClick={() => setSub("structures")}
          Icon={Building2}
        >
          Structures
        </SubTab>
        <SubTab on={sub === "units"} onClick={() => setSub("units")} Icon={Swords}>
          Troops
        </SubTab>
      </div>

      <ul className="divide-y divide-stone-200/70 dark:divide-[var(--color-edge)]">
        {sub === "regions" &&
          REGIONS.map((r) => {
            const cost = r.cost;
            const ok = e.resources.gold >= cost;
            return (
              <Row
                key={r.key}
                title={r.name}
                subtitle={r.note}
                swatch={REGION_COLOR[r.key]}
                owned={e.regions.reduce((n, reg) => n + (reg.type === r.key ? 1 : 0), 0)}
                cost={<Bag bag={{ gold: cost }} sign="-" />}
                disabled={!ok}
                reason={ok ? undefined : "Insufficient credits"}
                onBuild={() =>
                  dispatch({ kind: "BUY_REGION", regionType: r.key, qty: 1 })
                }
              />
            );
          })}

        {sub === "structures" &&
          (["R", "M"] as const).flatMap((cls) => {
            const group = STRUCTURES.filter((s) => s.class === cls);
            if (group.length === 0) return [];
            return [
              <ClassHeader key={`hdr-${cls}`} cls={cls} />,
              ...group.map((s) => {
                const check = canBuildStructure(e, s.key);
                return (
                  <Row
                    key={s.key}
                    title={s.name}
                    subtitle={requirementText(s, e)}
                    icon={structureIcon(s.key)}
                    owned={ownedStructures(s.key, cls)}
                    accent={cls === "M" ? "red" : "emerald"}
                    cost={<Bag bag={s.cost} sign="-" />}
                    disabled={!check.ok}
                    reason={check.reason}
                    onBuild={() =>
                      dispatch({ kind: "BUILD_STRUCTURE", structureKey: s.key })
                    }
                  />
                );
              }),
            ];
          })}

        {sub === "units" &&
          UNITS.map((u) => {
            const check = canBuildUnit(e, u.key, 1);
            return (
              <Row
                key={u.key}
                title={`${u.name} ×${u.batch}`}
                subtitle={u.domain}
                icon={unitIcon(u.key)}
                owned={e.units[u.key] ?? 0}
                cost={<Bag bag={u.cost} sign="-" />}
                disabled={!check.ok}
                reason={check.reason}
                onBuild={() =>
                  dispatch({ kind: "BUILD_UNIT", unitKey: u.key, batches: 1 })
                }
              />
            );
          })}
      </ul>

      <p className="px-4 py-2 font-display text-[11px] opacity-40">
        Treasury: {fmt(e.resources.gold)} credits · buying & building cost resources, not turns.
      </p>
    </section>
  );
}

/** Human-readable prerequisite summary, with "(have N)" so requirements are visible. */
function requirementText(s: StructureType, e: EmpireState): string {
  const parts: string[] = [];
  if (s.buildsOn) parts.push(`on a free ${s.buildsOn}`);
  if (s.requiresTech) parts.push(`needs ${TECH_BY_KEY.get(s.requiresTech)?.name ?? s.requiresTech}`);
  for (const [rk, n] of Object.entries(s.prereq?.regions ?? {})) {
    const have = e.regions.filter((r) => r.type === rk).length;
    parts.push(`${n}× ${rk} (have ${have})`);
  }
  for (const d of s.prereq?.structures ?? [])
    parts.push(`needs ${STRUCTURE_BY_KEY.get(d)?.name ?? d}`);
  for (const d of s.prereq?.units ?? [])
    parts.push(`needs ${UNIT_BY_KEY.get(d)?.name ?? d}`);
  for (const [r, v] of Object.entries(s.prereq?.resources ?? {}))
    parts.push(`${v} ${r}`);
  // Class is now conveyed by the section header, so M structures with no prereqs
  // simply show no subtitle.
  return parts.length ? parts.join(" · ") : "";
}

/** Section banner separating Economic (R) from Military (M) structures. */
function ClassHeader({ cls }: { cls: "R" | "M" }) {
  const isM = cls === "M";
  return (
    <li
      className={`flex items-baseline gap-2 px-4 py-1.5 font-display text-[11px] uppercase tracking-widest ${
        isM ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
      }`}
    >
      <span className="font-medium">{isM ? "Military" : "Economic"}</span>
      <span className="normal-case tracking-normal opacity-50">
        {isM ? "· empire-level, one click" : "· built on a free region tile"}
      </span>
    </li>
  );
}

function SubTab({
  on,
  onClick,
  Icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  Icon: typeof Map;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-display text-sm transition-colors ${
        on
          ? "bg-[var(--color-accent)] text-black"
          : "hover:bg-stone-100 dark:hover:bg-white/[0.03]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function Row({
  title,
  subtitle,
  cost,
  swatch,
  icon: Icon,
  accent,
  owned,
  disabled,
  reason,
  onBuild,
}: {
  title: string;
  subtitle?: string;
  cost: React.ReactNode;
  swatch?: string;
  icon?: LucideIcon;
  accent?: "red" | "emerald";
  owned?: number;
  disabled?: boolean;
  reason?: string;
  onBuild: () => void;
}) {
  return (
    <li className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:flex-nowrap">
      {accent && (
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-0.5 ${
            accent === "red" ? "bg-red-500/60" : "bg-emerald-500/60"
          }`}
        />
      )}
      {/* Name + description: takes the whole first row on mobile so long requirement
          text wraps wide instead of into a narrow sliver. */}
      <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
        {swatch && (
          <span
            className="h-4 w-4 shrink-0 rounded-sm"
            style={{ background: swatch }}
            title="Your color for this region type"
          />
        )}
        {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" />}
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-medium">
            {title}
            {owned ? <span className="ml-1.5 font-normal opacity-50">×{owned}</span> : null}
          </div>
          {subtitle && (
            <div className="font-display text-[11px] uppercase tracking-wide opacity-50">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {/* Cost + action: wraps to its own row on mobile; costs may wrap freely. */}
      <div className="flex flex-1 items-center justify-between gap-3 sm:flex-none sm:justify-end">
        <div className="min-w-0">{cost}</div>
        <button
          onClick={onBuild}
          disabled={disabled}
          title={disabled ? reason : undefined}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-stone-300 px-2.5 py-1.5 font-display text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-stone-300 disabled:hover:text-inherit dark:border-[var(--color-edge)]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Build
        </button>
      </div>
    </li>
  );
}

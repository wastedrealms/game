import { REGIONS, STRUCTURES, UNITS, TECHS, TECH_BY_KEY, type Resource } from "@wasted-realms/engine";
import { Coins } from "lucide-react";
import { Bag, RES_META, RES_ORDER } from "../ui/resources";
import { REGION_COLOR } from "../ui/regionColors";
import { structureIcon, unitIcon } from "../ui/itemIcons";

// One-line role for each resource (Codex reference).
const RES_INFO: Record<Resource, string> = {
  gold: "Primary currency. From region income, tax, and the market; spent on land, structures, units, and research facilities.",
  food: "Feeds your population every turn (1.6 per pop). A growing realm needs ever more — run out and you starve: support and population fall.",
  fuel: "Powers structure upkeep and the military. From Windmills, Power Plants, Technology regions, and Mountains.",
  ore: "Strategic resource mined on Mountains (Iron Ore Mine). Gates the Shipyard; freely traded on the market.",
  steel: "Strategic resource refined on Mountains (Steel Works). Gates the Shipyard and the Spaceport; freely traded.",
};

const TH = "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest opacity-70";
const TD = "px-4 py-3 align-top";
const ROW =
  "border-t border-stone-200/70 dark:border-[var(--color-edge)] hover:bg-stone-100/60 dark:hover:bg-white/[0.02] transition-colors";

export function Codex() {
  return (
    <section className="wr-boot overflow-hidden rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <div className="space-y-8 overflow-x-auto p-1">
        <Block title="Resources">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>Resource</th>
                <th className={TH}>Role</th>
              </tr>
            </thead>
            <tbody>
              {RES_ORDER.map((k) => {
                const { Icon, cls, label } = RES_META[k];
                return (
                  <tr key={k} className={ROW}>
                    <td className={`${TD} font-display font-medium`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 ${cls}`} strokeWidth={2.25} />
                        {label}
                      </span>
                    </td>
                    <td className={`${TD} max-w-2xl opacity-70`}>{RES_INFO[k]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Block>

        <Block title="Regions">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>Region</th>
                <th className={TH}>Cost</th>
                <th className={TH}>Income / turn</th>
                <th className={TH}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {REGIONS.map((r) => (
                <tr key={r.key} className={ROW}>
                  <td className={`${TD} font-display font-medium`}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: REGION_COLOR[r.key] }} />
                      {r.name}
                    </span>
                  </td>
                  <td className={`${TD} font-display tabular-nums`}>
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-[var(--color-gold)]" />
                      {r.cost}
                    </span>
                  </td>
                  <td className={TD}>
                    <Bag bag={r.income} sign="+" />
                  </td>
                  <td className={`${TD} max-w-xs opacity-60`}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        <Block title="Structures">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>Structure</th>
                <th className={TH}>Class</th>
                <th className={TH}>Cost</th>
                <th className={TH}>Produces</th>
                <th className={TH}>Upkeep</th>
              </tr>
            </thead>
            <tbody>
              {STRUCTURES.map((s) => {
                const Icon = structureIcon(s.key);
                return (
                <tr key={s.key} className={ROW}>
                  <td className={`${TD} font-display font-medium`}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      {s.name}
                    </span>
                  </td>
                  <td className={TD}>
                    <span
                      className={`rounded px-1.5 py-0.5 font-display text-xs ${
                        s.class === "M"
                          ? "bg-red-500/15 text-red-500 dark:text-red-400"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {s.class === "M" ? "Military" : "Economic"}
                    </span>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Bag bag={s.cost} sign="-" />
                      {s.prereq?.resources && <Bag bag={s.prereq.resources} sign="-" />}
                    </div>
                  </td>
                  <td className={TD}>
                    <Bag bag={s.produces} sign="+" />
                  </td>
                  <td className={TD}>
                    <Bag bag={s.upkeep} sign="-" />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </Block>

        <Block title="Troops">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>Unit</th>
                <th className={TH}>Batch</th>
                <th className={TH}>Domain</th>
                <th className={TH}>Cost / batch</th>
                <th className={TH}>Upkeep / batch</th>
              </tr>
            </thead>
            <tbody>
              {UNITS.map((u) => {
                const Icon = unitIcon(u.key);
                return (
                <tr key={u.key} className={ROW}>
                  <td className={`${TD} font-display font-medium`}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      {u.name}
                    </span>
                  </td>
                  <td className={`${TD} font-display tabular-nums`}>×{u.batch}</td>
                  <td className={TD}>
                    <span className="font-display text-xs uppercase tracking-wide opacity-70">
                      {u.domain}
                    </span>
                  </td>
                  <td className={TD}>
                    <Bag bag={u.cost} sign="-" />
                  </td>
                  <td className={TD}>
                    <Bag bag={u.upkeep} sign="-" />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </Block>

        <Block title="Research — Tech Ladder">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>Tier</th>
                <th className={TH}>Milestone</th>
                <th className={TH}>Cost (RP)</th>
                <th className={TH}>Requires</th>
                <th className={TH}>Unlocks</th>
              </tr>
            </thead>
            <tbody>
              {TECHS.map((t) => (
                <tr key={t.key} className={ROW}>
                  <td className={`${TD} font-display tabular-nums`}>T{t.tier}</td>
                  <td className={`${TD} font-display font-medium`}>{t.name}</td>
                  <td className={`${TD} font-display tabular-nums`}>{t.rpCost.toLocaleString()}</td>
                  <td className={`${TD} opacity-60`}>
                    {t.requires ? TECH_BY_KEY.get(t.requires)?.name ?? t.requires : "—"}
                  </td>
                  <td className={`${TD} max-w-md opacity-70`}>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="px-4 py-2 font-display text-xs font-semibold uppercase tracking-widest opacity-70">
        {title}
      </h3>
      {children}
    </div>
  );
}

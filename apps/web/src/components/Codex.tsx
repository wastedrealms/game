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

type Col = { key: string; header: string; cls?: string };
type Row = { key: string; cells: Record<string, React.ReactNode> };

/** Renders a real table on ≥sm and a stacked card per row on mobile, so the wide
 *  reference tables stay readable on a phone instead of scrolling off-screen. */
function DataTable({
  columns,
  rows,
  titleKey = columns[0].key,
}: {
  columns: Col[];
  rows: Row[];
  titleKey?: string;
}) {
  const fields = columns.filter((c) => c.key !== titleKey);
  return (
    <>
      {/* Desktop / tablet: a normal table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={TH}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={ROW}>
                {columns.map((c) => (
                  <td key={c.key} className={`${TD} ${c.cls ?? ""}`}>
                    {r.cells[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per row, fields as label/value pairs */}
      <div className="space-y-2.5 px-3 sm:hidden">
        {rows.map((r) => (
          <div
            key={r.key}
            className="rounded-md border border-stone-200/70 p-3 dark:border-[var(--color-edge)]"
          >
            <div className="font-display text-sm font-medium">{r.cells[titleKey]}</div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              {fields.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-xs uppercase tracking-wide opacity-50">{c.header}</dt>
                  <dd className="text-right opacity-80">{r.cells[c.key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

export function Codex() {
  return (
    <section className="wr-boot overflow-hidden rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <div className="space-y-8 py-1">
        <Block title="Resources">
          <DataTable
            columns={[
              { key: "resource", header: "Resource" },
              { key: "role", header: "Role", cls: "max-w-2xl opacity-70" },
            ]}
            rows={RES_ORDER.map((k) => {
              const { Icon, cls, label } = RES_META[k];
              return {
                key: k,
                cells: {
                  resource: (
                    <span className="inline-flex items-center gap-1.5 font-display font-medium">
                      <Icon className={`h-4 w-4 ${cls}`} strokeWidth={2.25} />
                      {label}
                    </span>
                  ),
                  role: <span className="opacity-70">{RES_INFO[k]}</span>,
                },
              };
            })}
          />
        </Block>

        <Block title="Regions">
          <DataTable
            columns={[
              { key: "region", header: "Region" },
              { key: "cost", header: "Cost" },
              { key: "income", header: "Income / turn" },
              { key: "notes", header: "Notes", cls: "max-w-xs opacity-60" },
            ]}
            rows={REGIONS.map((r) => ({
              key: r.key,
              cells: {
                region: (
                  <span className="inline-flex items-center gap-2 font-display font-medium">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ background: REGION_COLOR[r.key] }}
                    />
                    {r.name}
                  </span>
                ),
                cost: (
                  <span className="inline-flex items-center gap-1 font-display tabular-nums">
                    <Coins className="h-3.5 w-3.5 text-[var(--color-gold)]" />
                    {r.cost}
                  </span>
                ),
                income: <Bag bag={r.income} sign="+" />,
                notes: <span className="opacity-60">{r.note}</span>,
              },
            }))}
          />
        </Block>

        <Block title="Structures">
          <DataTable
            columns={[
              { key: "structure", header: "Structure" },
              { key: "class", header: "Class" },
              { key: "cost", header: "Cost" },
              { key: "produces", header: "Produces" },
              { key: "upkeep", header: "Upkeep" },
            ]}
            rows={STRUCTURES.map((s) => {
              const Icon = structureIcon(s.key);
              return {
                key: s.key,
                cells: {
                  structure: (
                    <span className="inline-flex items-center gap-2 font-display font-medium">
                      <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      {s.name}
                    </span>
                  ),
                  class: (
                    <span
                      className={`rounded px-1.5 py-0.5 font-display text-xs ${
                        s.class === "M"
                          ? "bg-red-500/15 text-red-500 dark:text-red-400"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {s.class === "M" ? "Military" : "Economic"}
                    </span>
                  ),
                  cost: (
                    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 sm:justify-start">
                      <Bag bag={s.cost} sign="-" />
                      {s.prereq?.resources && <Bag bag={s.prereq.resources} sign="-" />}
                    </div>
                  ),
                  produces: <Bag bag={s.produces} sign="+" />,
                  upkeep: <Bag bag={s.upkeep} sign="-" />,
                },
              };
            })}
          />
        </Block>

        <Block title="Troops">
          <DataTable
            columns={[
              { key: "unit", header: "Unit" },
              { key: "batch", header: "Batch" },
              { key: "domain", header: "Domain" },
              { key: "cost", header: "Cost / batch" },
              { key: "upkeep", header: "Upkeep / batch" },
            ]}
            rows={UNITS.map((u) => {
              const Icon = unitIcon(u.key);
              return {
                key: u.key,
                cells: {
                  unit: (
                    <span className="inline-flex items-center gap-2 font-display font-medium">
                      <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      {u.name}
                    </span>
                  ),
                  batch: <span className="font-display tabular-nums">×{u.batch}</span>,
                  domain: (
                    <span className="font-display text-xs uppercase tracking-wide opacity-70">
                      {u.domain}
                    </span>
                  ),
                  cost: <Bag bag={u.cost} sign="-" />,
                  upkeep: <Bag bag={u.upkeep} sign="-" />,
                },
              };
            })}
          />
        </Block>

        <Block title="Research — Tech Ladder">
          <DataTable
            titleKey="milestone"
            columns={[
              { key: "tier", header: "Tier" },
              { key: "milestone", header: "Milestone" },
              { key: "cost", header: "Cost (RP)" },
              { key: "requires", header: "Requires", cls: "opacity-60" },
              { key: "unlocks", header: "Unlocks", cls: "max-w-md opacity-70" },
            ]}
            rows={TECHS.map((t) => ({
              key: t.key,
              cells: {
                tier: <span className="font-display tabular-nums">T{t.tier}</span>,
                milestone: <span className="font-display font-medium">{t.name}</span>,
                cost: <span className="font-display tabular-nums">{t.rpCost.toLocaleString()}</span>,
                requires: (
                  <span className="opacity-60">
                    {t.requires ? TECH_BY_KEY.get(t.requires)?.name ?? t.requires : "—"}
                  </span>
                ),
                unlocks: <span className="opacity-70">{t.note}</span>,
              },
            }))}
          />
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

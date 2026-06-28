# Wasted Realms

A modern web reimagining of the classic BBS door games **Barren Realms Elite** and **Solar
Realms Elite**. Rule an empire on a shared planet, balance a **Credits / Food / Fuel** economy
(plus strategic **Ore / Steel**) across the chain **regions → structures → troops → actions**,
fight and ally with rival empires (human or NPC), research **technology**, and ascend from a
single planet toward your **solar system** and ultimately the **galaxy**.

> **Status:** Single-player playable — deterministic rules engine (lazy-accrual turns; buy
> land, build structures/units, the Credits/Food/Fuel income↔upkeep tick, combat, covert ops,
> market, diplomacy, the tech-tree ladder, NPC AI, victory conditions), and a full
> command-console UI (2D map + 3D planet, Build/Research/Military/Diplomacy/Market, Codex,
> About/Support).

## The core idea

```
  REGIONS ──▶ STRUCTURES ──▶ TROOPS ──▶ ACTIONS        balance: income vs expense
  (terrain)   (on terrain)   (at mil.    (attack/         across  🪙 Credits
                              structures)  covert/                 🌾 Food
                                           diplomacy)              ⛽ Fuel  (+ ⛏ Ore / 🔩 Steel)
  progression:  PLANET ──tech──▶ SOLAR SYSTEM ──tech──▶ GALAXY
```

## Monorepo layout

```
game/                    # repo: wastedrealms/game
├── packages/
│   └── engine/          @wasted-realms/engine — pure, deterministic game rules + data
│       ├── src/
│       │   ├── types.ts        core type definitions
│       │   ├── economy.ts      pure resource-bag helpers
│       │   ├── data/           reference tables (balance values)
│       │   └── index.ts        public API
│       └── test/               vitest suite
└── apps/
    └── web/             @wasted-realms/web — Vite + React + TS + Tailwind v4 + lucide
        └── src/
            ├── App.tsx         command-console UI (Phosphor Command aesthetic)
            ├── useTheme.ts     light/dark toggle (.dark class)
            └── index.css       Tailwind + design tokens
```

## Getting started

```bash
npm install        # install all workspaces
npm run dev        # start the web app (http://localhost:5173)
npm test           # run the engine test suite
npm run build      # typecheck + production build
npm run typecheck  # typecheck all workspaces
```

Requires Node ≥ 20 (developed on Node 24, npm 11).

## Tech stack

| Layer | Choice |
|-------|--------|
| Engine | Pure TypeScript, framework-agnostic, deterministic (no `Date.now`/`Math.random`/IO) |
| Frontend | Vite + React 18 + TypeScript |
| Styling | Tailwind CSS v4 (`.dark` class strategy), light/dark toggle |
| Icons | lucide-react |
| 3D | react-three-fiber + three (lazy-loaded shared planet) |
| Tests | Vitest |
| Hosting | Static deploy to S3 + CloudFront via GitHub Actions (`game.wastedrealms.com`) |
| Planned | Authoritative multiplayer backend (Convex, or serverless + Postgres + cron) |

## Play & support

Wasted Realms is **free to play — no ads, no paywall**, hosted at
**game.wastedrealms.com** (part of the [wastedrealms.com](https://wastedrealms.com) games
portal). If you're enjoying it, the in-app **About** dialog (ⓘ in the header) has an optional
**donate** button. Ideas and bugs are very welcome via
[GitHub Issues](../../issues/new/choose).

## License / IP

An original homage to BRE/SRE — new names, art, and balance numbers. Not affiliated with the
original works.

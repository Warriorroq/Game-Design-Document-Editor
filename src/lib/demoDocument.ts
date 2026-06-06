import { normalizeDocument } from "./document";
import type { BoardText, GddDocument, GddSection } from "../types";

function section(
  title: string,
  description: string,
  content: string,
  extras?: Pick<GddSection, "texts">
): GddSection {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    content,
    order: 0,
    board: [],
    shapes: [],
    strokes: [],
    texts: extras?.texts ?? [],
    groups: [],
  };
}

function deskText(content: string, x: number, y: number): BoardText {
  return {
    id: crypto.randomUUID(),
    content,
    x,
    y,
    width: 220,
    fontSize: 14,
  };
}

export function createDemoDocument(): GddDocument {
  const sections: GddSection[] = [
    section(
      "Project overview",
      "Vision, audience, and unique value",
      `## Vision

**Neon Drift** is an arcade racer set in a neon megacity of the future. Sessions run 8–12 minutes, focused on risk/reward and readable gameplay on gamepad and keyboard.

### Target audience

- Age **16+**, fans of *Hot Wheels Unleashed*, *Wipeout*, and indie arcade racers
- Plays short evening runs
- Values car customization and leaderboards

### Design pillars

1. Speed is felt from the first second
2. Tracks read clearly without UI clutter
3. Progression is cosmetic, not pay-to-win`
    ),
    section(
      "Gameplay loop",
      "Core loop, controls, boost, and penalties",
      `## Core loop

Pick a track → 3 laps → reward (credits + rep) → garage upgrade → new league.

### Controls

| Input | Action |
|------|--------|
| RT / Shift | Throttle |
| LT / Ctrl | Brake / drift |
| A / Space | Boost (limited charge) |
| B | Camera toggle |

### Risk / reward

- **Near-miss** along walls adds +5% to the score multiplier
- A crash resets the multiplier but does not stop the race
- Perfect lap — 500 CR bonus`,
      {
        texts: [
          deskText("Multiplier ×3 — only 2 sec!", 80, 60),
          deskText("Drift: angle > 25°", 320, 140),
        ],
      }
    ),
    section(
      "Setting and story",
      "World, factions, episodic delivery",
      `## Megacity Lumin-7

The city is split into **rings** — from the industrial zone to sponsor skyscrapers. Racing is a legal sport and a path up the social ladder.

> "You don't buy victory. You buy the right to run a higher ring." — *Kira Motors* sponsor

### Factions

- **Pulse Crew** — street mechanics, custom body kits
- **Null Division** — corporate pilots, factory builds
- **Ghost Line** — illegal night runs (DLC arc)

Story is delivered in **30-second** clips between leagues, no cutscenes over a minute.`
    ),
    section(
      "Characters",
      "Pilots, motivations, dialogue tags",
      `## Lead pilots

### Mira "Spark" Kowal

Pulse Crew leader. Short lines, jokes under pressure. Arc: prove a street build can beat the factory.

### Declan Voss

Null Division antagonist. Cold, stats over emotion.

### Supporting cast

| Name | Role | Unique ability |
|------|------|----------------|
| Juno | Tutorial | Ideal racing line highlight |
| Rex | League 2 rival | EMP trap on track |
| Ayu | Shop | 10% vinyl discount |

Dialogue — **2–4 lines** per race, no full-screen branches.`
    ),
    section(
      "Track design",
      "Biomes, hazards, flow",
      `## Campaign structure

12 tracks in the base game + 4 night tracks in Ghost Line.

### Biomes

1. **Dock Ring** — containers, tight chicanes, water as set dressing
2. **Skyline Loop** — bridges, wind (light lateral drift)
3. **Core Spire** — vertical loops, magnetic rails

### Hazards

- Laser gates (timing)
- Breakable barriers (one-time shortcut)
- Dynamic billboards (line changes once per lap)

Every track passes a **blind lap** test — designer completes it without the minimap.`,
      {
        texts: [deskText("Shortcut: break barrier ×2", 100, 90)],
      }
    ),
    section(
      "Art direction",
      "Palette, silhouettes, VFX",
      `## Visual language

- Palette: **cyan / magenta / deep indigo**
- Car silhouettes read at 200 m — tall bodies, neon edge strips
- UI — semi-transparent panels, geometric sans type

### VFX priorities

\`\`\`
1. Tire trails (drift)
2. Collision sparks
3. Boost trail
4. Rain (night tracks only)
\`\`\`

References: 80s synthwave posters + *Tron Legacy* clarity without bloom overload.`
    ),
    section(
      "Audio and music",
      "SFX, OST, adaptive layers",
      `## Audio pillars

**OST**: electronic 110–128 BPM, sidechain on kick. Menu — calm ambient.

### SFX

- Engine: 3 layers (low / mid / turbo)
- Drift: filtered noise layer
- UI: short clicks, no long sweeps

### Adaptivity

At multiplier ×2 a **hi-hat layer** joins; at ×3 — synth pad. Crash — 300 ms ducking.

Pilot voice lines — **EN** with optional localization packs.`
    ),
    section(
      "UI and UX",
      "HUD, garage, accessibility",
      `## Race HUD

- Position / lap / timer — top center
- Multiplier — right, pulses as it grows
- Minimap — optional (on by default)

### Garage

Flow: pick car → vinyl slots → 15 s test drive on *Test Strip*.

### Accessibility

- Dalton-friendly UI palettes
- **Colorblind** mode for hazards
- Subtitle scale 100–150%
- Full control remapping`,
      {
        texts: [deskText("HUD: minimap OFF?", 60, 50)],
      }
    ),
    section(
      "Technical requirements",
      "Engine, performance, platforms",
      `## Stack

- **Unity 6** URP, target 1080p60 on Switch 2–class hardware
- Addressables for tracks and cars
- Netcode: async leaderboards only (PlayFab / Steam)

### Budgets

| Platform | FPS | VRAM |
|----------|-----|------|
| PC mid | 120 | 4 GB |
| Steam Deck | 60 | 3 GB |
| Xbox Series S | 60 | 4 GB |

Saves: local slot + cloud where the platform API allows.`
    ),
    section(
      "Monetization",
      "Model, cosmetics, seasons",
      `## Model

Premium **$24.99**, no loot boxes. DLC — full leagues and soundtracks.

### In-game economy

- **CR (credits)** — PvE rewards only
- **Neon Shards** — seasonal track, cosmetics

8-week season: 50 levels, 30% free track, premium — skins and boost trail VFX.`
    ),
    section(
      "Risks and plan",
      "Milestones, risks, gold criteria",
      `## Milestones

- **M1 (month 3)** — vertical slice: 1 track, 1 car, garage
- **M2 (month 7)** — alpha: 6 tracks, 4 pilots
- **M3 (month 11)** — content lock, polish, certification

### Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope creep VFX | High | Freeze effect list at M2 |
| FPS drop on Deck | Medium | Weekly profiling |
| VO delay | Low | 4-week buffer before RC |

**Gold criteria**: campaign clearable in 6 h, 0 blockers, internal playtest ≥ 8/10.`
    ),
  ].map((s, order) => ({ ...s, order }));

  const doc: GddDocument = {
    id: crypto.randomUUID(),
    title: "Neon Drift",
    subtitle: "Demo GDD — 10 sections",
    lastModified: new Date().toISOString(),
    sections,
  };

  return normalizeDocument(doc);
}

/**
 * Procedural pixel-art trout sprite generator.
 *
 * Draws chunky, grid-snapped trout sprites in the style of top-down
 * pixel art (similar to the chicken reference). Each "art pixel" is a
 * small square rendered via PIXI.Graphics.rect().
 */

import * as PIXI from "pixi.js";
import type { TroutTier } from "@/types";

// ─── Color Palettes ──────────────────────────────────────────

interface Palette {
  back: number;
  body: number;
  belly: number;
  stripe: number;
  outline: number;
  eye: number;
  tail: number;
  fin: number;
  spot: number;
}

const PALETTES: Record<TroutTier, Palette> = {
  1: {
    // Fry — pale silvery
    outline: 0x4a6652,
    back: 0x6b8e73,
    body: 0x8aaa8e,
    belly: 0xb5ccb8,
    stripe: 0xcc9e9e,
    eye: 0x1a1a1a,
    tail: 0x6b8e73,
    fin: 0x7a9a80,
    spot: 0x4a6a4e,
  },
  2: {
    // Fingerling — classic young trout
    outline: 0x3d5c3e,
    back: 0x5a7a5e,
    body: 0x7a9a70,
    belly: 0xa8c09c,
    stripe: 0xd4938a,
    eye: 0x1a1a1a,
    tail: 0x6a8a5e,
    fin: 0x7a9a6e,
    spot: 0x3a5a36,
  },
  3: {
    // Juvenile — richer colors
    outline: 0x2e4a30,
    back: 0x4a6a4a,
    body: 0x6a8a60,
    belly: 0xa0b894,
    stripe: 0xd88878,
    eye: 0x111111,
    tail: 0x5a7a50,
    fin: 0x6a8a5a,
    spot: 0x2e4428,
  },
  4: {
    // Adult — vivid
    outline: 0x263e28,
    back: 0x3e5e3e,
    body: 0x5e7e54,
    belly: 0x98b48c,
    stripe: 0xe07060,
    eye: 0x0a0a0a,
    tail: 0x4e6e44,
    fin: 0x5e7e4e,
    spot: 0x243820,
  },
  5: {
    // Trophy — golden undertones
    outline: 0x2a3e1e,
    back: 0x4a6636,
    body: 0x6a8a4e,
    belly: 0xb0c890,
    stripe: 0xe8644e,
    eye: 0x080808,
    tail: 0x546e3a,
    fin: 0x648a44,
    spot: 0x1e3418,
  },
  6: {
    // Leviathan — deep, legendary
    outline: 0x1e3018,
    back: 0x365830,
    body: 0x547a42,
    belly: 0xa8c484,
    stripe: 0xf05840,
    eye: 0x060606,
    tail: 0x466834,
    fin: 0x567e3c,
    spot: 0x142810,
  },
};

// ─── Grid Definitions ────────────────────────────────────────
// 0=transparent, 1=outline, 2=back, 3=body, 4=belly, 5=stripe,
// 6=eye, 7=tail, 8=fin, 9=spot

// SMALL: 9x5 — used for tiers 1-2
const GRID_SMALL: number[][] = [
  [0, 0, 7, 0, 1, 1, 1, 0, 0],
  [0, 7, 1, 1, 2, 2, 1, 1, 0],
  [7, 7, 1, 3, 5, 3, 3, 1, 6],
  [0, 7, 1, 1, 4, 4, 1, 1, 0],
  [0, 0, 7, 0, 1, 1, 1, 0, 0],
];

// MEDIUM: 16x9 — used for tiers 3-4
const GRID_MEDIUM: number[][] = [
  [0, 7, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 7, 7, 0, 1, 1, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 7, 1, 1, 2, 9, 2, 2, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 2, 2, 2, 3, 9, 3, 2, 1, 1, 8, 0, 0],
  [0, 0, 1, 1, 3, 5, 5, 5, 3, 3, 3, 3, 1, 1, 6, 0],
  [0, 0, 0, 1, 4, 4, 4, 4, 4, 4, 3, 1, 1, 8, 0, 0],
  [0, 0, 7, 1, 1, 4, 4, 4, 4, 1, 1, 1, 0, 0, 0, 0],
  [0, 7, 7, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 7, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
];

// LARGE: 22x11 — used for tiers 5-6
const GRID_LARGE: number[][] = [
  [0, 7, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 7, 7, 0, 0, 1, 1, 1, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 7, 7, 1, 1, 2, 2, 9, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 7, 1, 2, 2, 9, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 2, 2, 2, 3, 9, 3, 3, 2, 2, 1, 1, 1, 8, 8, 0, 0, 0],
  [0, 0, 0, 1, 1, 3, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 1, 1, 1, 6, 6, 0],
  [0, 0, 0, 0, 1, 4, 4, 4, 4, 4, 4, 4, 3, 3, 1, 1, 1, 8, 8, 0, 0, 0],
  [0, 0, 0, 7, 1, 1, 4, 4, 4, 4, 4, 4, 3, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 7, 7, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 7, 7, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 7, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// ─── Tier → Grid + Pixel-Size Mapping ────────────────────────

interface SpriteConfig {
  grid: number[][];
  px: number;
}

const SPRITE_CONFIGS: Record<TroutTier, SpriteConfig> = {
  1: { grid: GRID_SMALL, px: 1 },
  2: { grid: GRID_SMALL, px: 2 },
  3: { grid: GRID_MEDIUM, px: 2 },
  4: { grid: GRID_MEDIUM, px: 3 },
  5: { grid: GRID_LARGE, px: 3 },
  6: { grid: GRID_LARGE, px: 5 },
};

// ─── Exported Sprite Sizes ───────────────────────────────────

export function getSpriteSize(tier: TroutTier): { w: number; h: number } {
  const cfg = SPRITE_CONFIGS[tier];
  return {
    w: cfg.grid[0].length * cfg.px,
    h: cfg.grid.length * cfg.px,
  };
}

// ─── Color Resolver ──────────────────────────────────────────

function resolveColor(cell: number, palette: Palette): number | null {
  switch (cell) {
    case 0:
      return null; // transparent
    case 1:
      return palette.outline;
    case 2:
      return palette.back;
    case 3:
      return palette.body;
    case 4:
      return palette.belly;
    case 5:
      return palette.stripe;
    case 6:
      return palette.eye;
    case 7:
      return palette.tail;
    case 8:
      return palette.fin;
    case 9:
      return palette.spot;
    default:
      return null;
  }
}

// ─── Texture Generators ──────────────────────────────────────

/**
 * Generate pixel-art trout textures for all 6 tiers.
 */
export function createTroutTextures(
  app: PIXI.Application
): Map<TroutTier, PIXI.Texture> {
  const textures = new Map<TroutTier, PIXI.Texture>();
  const tiers: TroutTier[] = [1, 2, 3, 4, 5, 6];

  for (const tier of tiers) {
    const cfg = SPRITE_CONFIGS[tier];
    const palette = PALETTES[tier];
    const g = new PIXI.Graphics();

    for (let r = 0; r < cfg.grid.length; r++) {
      for (let c = 0; c < cfg.grid[r].length; c++) {
        const color = resolveColor(cfg.grid[r][c], palette);
        if (color !== null) {
          g.rect(c * cfg.px, r * cfg.px, cfg.px, cfg.px);
          g.fill(color);
        }
      }
    }

    textures.set(tier, app.renderer.generateTexture(g));
    g.destroy();
  }

  return textures;
}

/**
 * Generate shadow textures (dark semi-transparent ellipses) for each tier.
 */
export function createShadowTextures(
  app: PIXI.Application
): Map<TroutTier, PIXI.Texture> {
  const textures = new Map<TroutTier, PIXI.Texture>();
  const tiers: TroutTier[] = [1, 2, 3, 4, 5, 6];

  for (const tier of tiers) {
    const size = getSpriteSize(tier);
    const rx = size.w * 0.4;
    const ry = size.h * 0.22;
    const g = new PIXI.Graphics();
    g.ellipse(rx, ry, rx, ry);
    g.fill({ color: 0x0a2a1a, alpha: 0.25 });
    textures.set(tier, app.renderer.generateTexture(g));
    g.destroy();
  }

  return textures;
}

/**
 * Generate small dot textures for LOD (far zoom).
 */
export function createDotTextures(
  app: PIXI.Application
): Map<TroutTier, PIXI.Texture> {
  const textures = new Map<TroutTier, PIXI.Texture>();
  const dotSizes: Record<TroutTier, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 3,
    5: 4,
    6: 5,
  };

  const tiers: TroutTier[] = [1, 2, 3, 4, 5, 6];
  for (const tier of tiers) {
    const s = dotSizes[tier];
    const g = new PIXI.Graphics();
    g.circle(s, s, s);
    g.fill(PALETTES[tier].body);
    textures.set(tier, app.renderer.generateTexture(g));
    g.destroy();
  }

  return textures;
}

/**
 * Generate a tiling water background texture.
 * Returns a texture that can be used with a TilingSprite.
 */
export function createWaterTexture(app: PIXI.Application): PIXI.Texture {
  const tileSize = 128;
  const g = new PIXI.Graphics();

  // Base water color
  g.rect(0, 0, tileSize, tileSize);
  g.fill(0x2a5c5a);

  // Subtle depth variation — darker and lighter patches
  const rng = mulberry32(42);
  for (let i = 0; i < 30; i++) {
    const x = rng() * tileSize;
    const y = rng() * tileSize;
    const r = 4 + rng() * 12;
    const bright = rng() > 0.5;
    g.circle(x, y, r);
    g.fill({ color: bright ? 0x3a6e6a : 0x1e4a48, alpha: 0.2 + rng() * 0.15 });
  }

  // Small light caustic highlights
  for (let i = 0; i < 12; i++) {
    const x = rng() * tileSize;
    const y = rng() * tileSize;
    const r = 1 + rng() * 2;
    g.circle(x, y, r);
    g.fill({ color: 0x5a9a8a, alpha: 0.15 + rng() * 0.1 });
  }

  // Tiny pebbles / debris at bottom of water
  for (let i = 0; i < 8; i++) {
    const x = rng() * tileSize;
    const y = rng() * tileSize;
    g.circle(x, y, 1);
    g.fill({ color: 0x1a3a32, alpha: 0.3 });
  }

  const texture = app.renderer.generateTexture(g);
  g.destroy();
  return texture;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Simple seeded PRNG (Mulberry32) for deterministic backgrounds. */
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

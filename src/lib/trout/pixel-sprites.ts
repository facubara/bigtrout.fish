/**
 * Trout sprite generator using the chatgpt_trout_animation.png spritesheet.
 *
 * Loads a pre-processed 3x2 spritesheet (6 frames, each 512x295)
 * with transparent background and creates per-tier animated texture
 * arrays. Falls back to colored placeholders until the spritesheet loads.
 */

import * as PIXI from "pixi.js";
import type { TroutTier } from "@/types";

// ─── Spritesheet layout (pre-processed clean version) ────────

const SHEET_COLS = 3;
const SHEET_ROWS = 2;
const FRAME_W = 512;
const FRAME_H = 295;
export const FRAME_COUNT = SHEET_COLS * SHEET_ROWS; // 6

// ─── Tier Sprite Sizes (width in pixels) ─────────────────────

const TIER_WIDTHS: Record<TroutTier, number> = {
  1: 16,
  2: 24,
  3: 36,
  4: 48,
  5: 64,
  6: 90,
};

// Aspect ratio from the cropped frame (512 / 295)
const TROUT_ASPECT = FRAME_W / FRAME_H;

// ─── Exported Sprite Sizes ───────────────────────────────────

export function getSpriteSize(tier: TroutTier): { w: number; h: number } {
  const w = TIER_WIDTHS[tier];
  return { w, h: Math.round(w / TROUT_ASPECT) };
}

// ─── Dot colors per tier (used for far-zoom LOD) ─────────────

const DOT_COLORS: Record<TroutTier, number> = {
  1: 0x8aaa8e,
  2: 0x7a9a70,
  3: 0x6a8a60,
  4: 0x5e7e54,
  5: 0x6a8a4e,
  6: 0x547a42,
};

// ─── Texture Generators ──────────────────────────────────────

/**
 * Load the trout spritesheet and create per-tier animated textures.
 * Returns a map of tier → PIXI.Texture[] (6 frames each).
 * Placeholder textures are provided immediately; real frames
 * replace them once the spritesheet loads.
 */
export function createTroutTextures(
  app: PIXI.Application
): Map<TroutTier, PIXI.Texture[]> {
  const textures = new Map<TroutTier, PIXI.Texture[]>();
  const tiers: TroutTier[] = [1, 2, 3, 4, 5, 6];

  // Provide placeholder frames so sprites render immediately
  for (const tier of tiers) {
    const size = getSpriteSize(tier);
    const frames: PIXI.Texture[] = [];
    for (let f = 0; f < FRAME_COUNT; f++) {
      const g = new PIXI.Graphics();
      g.rect(0, 0, size.w, size.h);
      g.fill(DOT_COLORS[tier]);
      frames.push(app.renderer.generateTexture(g));
      g.destroy();
    }
    textures.set(tier, frames);
  }

  // Load clean spritesheet and replace placeholders with real frames
  PIXI.Assets.load<PIXI.Texture>("/chatgpt_trout_animation.png").then(
    (sheetTex) => {
      // Extract 6 frame textures from the spritesheet
      const baseFrames: PIXI.Texture[] = [];
      for (let row = 0; row < SHEET_ROWS; row++) {
        for (let col = 0; col < SHEET_COLS; col++) {
          baseFrames.push(
            new PIXI.Texture({
              source: sheetTex.source,
              frame: new PIXI.Rectangle(
                col * FRAME_W,
                row * FRAME_H,
                FRAME_W,
                FRAME_H
              ),
            })
          );
        }
      }

      // Create scaled frames for each tier
      for (const tier of tiers) {
        const size = getSpriteSize(tier);
        const tierFrames = textures.get(tier)!;
        for (let f = 0; f < FRAME_COUNT; f++) {
          const sprite = new PIXI.Sprite(baseFrames[f]);
          sprite.width = size.w;
          sprite.height = size.h;
          tierFrames[f] = app.renderer.generateTexture(sprite);
          sprite.destroy();
        }
      }
    }
  );

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
    g.fill(DOT_COLORS[tier]);
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

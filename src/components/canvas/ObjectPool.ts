import * as PIXI from "pixi.js";
import type { TroutTier } from "@/types";

const GROW_SIZE = 50;
const SHRINK_DELAY_MS = 30_000;

/**
 * Sprite object pool to avoid GC pressure from create/destroy cycles.
 */
export class SpritePool {
  private available: PIXI.Sprite[] = [];
  private active = new Map<string, PIXI.Sprite>();
  private parent: PIXI.Container;
  private lastShrinkCheck = 0;

  constructor(parent: PIXI.Container, initialSize: number = 200) {
    this.parent = parent;
    this.prewarm(initialSize);
  }

  /** Get a sprite from the pool or create one. */
  acquire(address: string): PIXI.Sprite {
    const existing = this.active.get(address);
    if (existing) return existing;

    let sprite = this.available.pop();
    if (!sprite) {
      this.grow(GROW_SIZE);
      sprite = this.available.pop()!;
    }

    sprite.visible = true;
    this.active.set(address, sprite);
    return sprite;
  }

  /** Return a sprite to the pool. */
  release(address: string): void {
    const sprite = this.active.get(address);
    if (!sprite) return;

    sprite.visible = false;
    sprite.x = -9999;
    sprite.y = -9999;
    this.active.delete(address);
    this.available.push(sprite);
  }

  /** Release all sprites not in the given set of addresses. */
  releaseExcept(keepAddresses: Set<string>): void {
    const toRelease: string[] = [];
    for (const addr of this.active.keys()) {
      if (!keepAddresses.has(addr)) {
        toRelease.push(addr);
      }
    }
    for (const addr of toRelease) {
      this.release(addr);
    }
  }

  /** Pre-create sprites. */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new PIXI.Sprite();
      sprite.visible = false;
      sprite.anchor.set(0.5);
      sprite.x = -9999;
      sprite.y = -9999;
      this.parent.addChild(sprite);
      this.available.push(sprite);
    }
  }

  /** Shrink pool if oversized. Call periodically. */
  maybeShrink(): void {
    const now = Date.now();
    if (now - this.lastShrinkCheck < SHRINK_DELAY_MS) return;
    this.lastShrinkCheck = now;

    const excess = this.available.length - this.active.size;
    if (excess > GROW_SIZE * 2) {
      const toRemove = Math.floor(excess / 2);
      for (let i = 0; i < toRemove; i++) {
        const sprite = this.available.pop();
        if (sprite) {
          this.parent.removeChild(sprite);
          sprite.destroy();
        }
      }
    }
  }

  get(address: string): PIXI.Sprite | undefined {
    return this.active.get(address);
  }

  get activeCount(): number {
    return this.active.size;
  }

  get poolSize(): number {
    return this.available.length + this.active.size;
  }

  private grow(count: number): void {
    this.prewarm(count);
  }
}

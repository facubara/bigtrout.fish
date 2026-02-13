"use client";

import { useEffect, useRef, useCallback } from "react";
import * as PIXI from "pixi.js";
import { useTroutStore } from "@/lib/store";
import {
  createCamera,
  updateCamera,
  zoomToward,
  panBy,
  screenToWorld,
  getVisibleBounds,
  type Camera,
} from "./Camera";
import { SpritePool } from "./ObjectPool";
import type { TroutTier, VisibleTrout } from "@/types";

// ─── Tier colors for placeholder rendering ───────────────────

const TIER_COLORS: Record<TroutTier, number> = {
  1: 0x88ccee, // light blue
  2: 0x44aa88, // teal
  3: 0x33bb55, // green
  4: 0xddcc33, // gold
  5: 0xff8833, // orange
  6: 0xff3355, // red
};

const TIER_SIZES: Record<TroutTier, { w: number; h: number }> = {
  1: { w: 8, h: 4 },
  2: { w: 16, h: 8 },
  3: { w: 32, h: 16 },
  4: { w: 48, h: 24 },
  5: { w: 64, h: 32 },
  6: { w: 96, h: 48 },
};

// Dot sizes for LOD rendering (far zoom)
const TIER_DOT_SIZES: Record<TroutTier, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 3,
  5: 4,
  6: 5,
};

// ─── Component ───────────────────────────────────────────────

export default function TroutScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const poolRef = useRef<SpritePool | null>(null);
  const dotPoolRef = useRef<SpritePool | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const visibleTroutsRef = useRef<VisibleTrout[]>([]);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  // NOTE: quality, selectedTrout, and setHoveredTrout are read via
  // useTroutStore.getState() inside the render loop to avoid re-mounting
  // the entire PixiJS application when these values change.

  // Generate placeholder textures for each tier
  const texturesRef = useRef<Map<TroutTier, PIXI.Texture>>(new Map());
  const dotTexturesRef = useRef<Map<TroutTier, PIXI.Texture>>(new Map());

  const createPlaceholderTextures = useCallback((app: PIXI.Application) => {
    const tiers: TroutTier[] = [1, 2, 3, 4, 5, 6];
    for (const tier of tiers) {
      // Sprite textures
      const { w, h } = TIER_SIZES[tier];
      const g = new PIXI.Graphics();
      g.ellipse(w / 2, h / 2, w / 2, h / 2);
      g.fill(TIER_COLORS[tier]);
      g.moveTo(0, h / 4);
      g.lineTo(-w / 4, 0);
      g.lineTo(0, (h * 3) / 4);
      g.closePath();
      g.fill(TIER_COLORS[tier]);
      const texture = app.renderer.generateTexture(g);
      texturesRef.current.set(tier, texture);
      g.destroy();

      // Dot textures for LOD
      const dotSize = TIER_DOT_SIZES[tier];
      const dg = new PIXI.Graphics();
      dg.circle(dotSize, dotSize, dotSize);
      dg.fill(TIER_COLORS[tier]);
      const dotTex = app.renderer.generateTexture(dg);
      dotTexturesRef.current.set(tier, dotTex);
      dg.destroy();
    }
  }, []);

  // ─── Initialize PixiJS ───────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    const container = containerRef.current;

    async function init() {
      const app = new PIXI.Application();
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x2d6a5a,
        antialias: false,
        resolution: window.devicePixelRatio,
        autoDensity: true,
        powerPreference: "high-performance",
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      // Create placeholder textures
      createPlaceholderTextures(app);

      // Layer hierarchy per spec
      const backgroundLayer = new PIXI.Container();
      const dotLayer = new PIXI.Container();
      const troutLayer = new PIXI.Container();
      const labelLayer = new PIXI.Container();
      app.stage.addChild(backgroundLayer);
      app.stage.addChild(dotLayer);
      app.stage.addChild(troutLayer);
      app.stage.addChild(labelLayer);

      // Background -- solid river color extended far
      const bg = new PIXI.Graphics();
      bg.rect(-50000, -50000, 100000, 100000);
      bg.fill(0x2d6a5a);
      backgroundLayer.addChild(bg);

      // Camera
      const cam = createCamera(app.screen.width, app.screen.height);
      cameraRef.current = cam;

      // Object pools
      const pool = new SpritePool(troutLayer, 300);
      poolRef.current = pool;
      const dotPool = new SpritePool(dotLayer, 500);
      dotPoolRef.current = dotPool;

      // Spawn Web Worker
      const worker = new Worker(
        new URL("../../workers/trout-simulation.worker.ts", import.meta.url)
      );
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === "VISIBLE_TROUTS") {
          const { addresses, buffer, count } = msg;
          const trouts: VisibleTrout[] = [];
          for (let i = 0; i < count; i++) {
            const off = i * 6;
            trouts.push({
              address: addresses[i],
              x: buffer[off],
              y: buffer[off + 1],
              direction: buffer[off + 2] as 1 | -1,
              tier: buffer[off + 3] as TroutTier,
              scale: buffer[off + 4],
              animFrame: buffer[off + 5],
            });
          }
          visibleTroutsRef.current = trouts;
        }
      };

      // Start render loop
      lastTimeRef.current = performance.now();
      function loop(time: number) {
        if (destroyed) return;
        const delta = time - lastTimeRef.current;
        lastTimeRef.current = time;

        // Send tick to worker
        worker.postMessage({ type: "TICK", payload: { deltaMs: delta } });

        // Update camera
        const cam = cameraRef.current!;

        // Follow selected trout
        const selAddr = useTroutStore.getState().selectedTrout;
        if (selAddr) {
          const vis = visibleTroutsRef.current.find((t) => t.address === selAddr);
          if (vis) {
            cam.targetX = vis.x;
            cam.targetY = vis.y;
            if (cam.targetZoom < 1.5) cam.targetZoom = 1.5;
          }
        }

        updateCamera(cam);

        // Apply camera to stage
        app.stage.scale.set(cam.zoom);
        app.stage.x = app.screen.width / 2 - cam.x * cam.zoom;
        app.stage.y = app.screen.height / 2 - cam.y * cam.zoom;

        // Send viewport to worker
        const bounds = getVisibleBounds(cam);
        worker.postMessage({ type: "SET_VIEWPORT", payload: bounds });

        // Reconcile sprites with LOD support
        const visible = visibleTroutsRef.current;
        const visibleSet = new Set(visible.map((t) => t.address));
        const spritePool = poolRef.current!;
        const dPool = dotPoolRef.current!;

        // Get quality from store
        const currentQuality = useTroutStore.getState().quality;
        const maxSprites =
          currentQuality === "low"
            ? 100
            : currentQuality === "medium"
              ? 300
              : 600;

        // Determine if we should use dot LOD based on quality and zoom
        const useDots =
          currentQuality === "low"
            ? cam.zoom < 1.0
            : currentQuality === "medium"
              ? cam.zoom < 0.3
              : cam.zoom < 0.15;

        if (useDots) {
          // LOD mode: render as dots, release all sprites
          spritePool.releaseExcept(new Set<string>());
          dPool.releaseExcept(visibleSet);

          const count = Math.min(visible.length, maxSprites * 2);
          for (let i = 0; i < count; i++) {
            const t = visible[i];
            const dot = dPool.acquire(t.address);
            dot.x = t.x;
            dot.y = t.y;
            const dotTex = dotTexturesRef.current.get(t.tier);
            if (dotTex && dot.texture !== dotTex) {
              dot.texture = dotTex;
            }
          }
        } else {
          // Full sprite mode: release all dots
          dPool.releaseExcept(new Set<string>());
          spritePool.releaseExcept(visibleSet);

          const count = Math.min(visible.length, maxSprites);
          for (let i = 0; i < count; i++) {
            const t = visible[i];
            const sprite = spritePool.acquire(t.address);
            sprite.x = t.x;
            sprite.y = t.y;

            // Apply tier texture
            const tex = texturesRef.current.get(t.tier);
            if (tex && sprite.texture !== tex) {
              sprite.texture = tex;
            }

            // Apply scale and direction
            const s = t.scale || 1;
            sprite.scale.x = t.direction * s;
            sprite.scale.y = s;

            // Make interactive for hover
            sprite.eventMode = "static";
            sprite.cursor = "pointer";
          }
        }

        spritePool.maybeShrink();
        dPool.maybeShrink();
        rafRef.current = requestAnimationFrame(loop);
      }

      rafRef.current = requestAnimationFrame(loop);

      // Handle resize
      const onResize = () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        if (cameraRef.current) {
          cameraRef.current.viewWidth = window.innerWidth;
          cameraRef.current.viewHeight = window.innerHeight;
        }
      };
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
      };
    }

    init();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- quality and selectedTrout are read via getState() inside the loop
  }, [createPlaceholderTextures]);

  // ─── Input Handlers ──────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !cameraRef.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    panBy(cameraRef.current, dx, dy);
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const world = screenToWorld(cam, e.clientX, e.clientY);
    zoomToward(cam, world.x, world.y, -e.deltaY);
  }, []);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const world = screenToWorld(cam, e.clientX, e.clientY);
    zoomToward(cam, world.x, world.y, 500); // zoom in 2x at point
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      style={{ touchAction: "none" }}
    />
  );
}

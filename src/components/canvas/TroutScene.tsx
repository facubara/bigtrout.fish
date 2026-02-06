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

// ─── Component ───────────────────────────────────────────────

export default function TroutScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const poolRef = useRef<SpritePool | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const visibleTroutsRef = useRef<VisibleTrout[]>([]);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  const quality = useTroutStore((s) => s.quality);
  const setHoveredTrout = useTroutStore((s) => s.setHoveredTrout);
  const selectedTrout = useTroutStore((s) => s.selectedTrout);

  // Generate placeholder textures for each tier
  const texturesRef = useRef<Map<TroutTier, PIXI.Texture>>(new Map());

  const createPlaceholderTextures = useCallback((app: PIXI.Application) => {
    const tiers: TroutTier[] = [1, 2, 3, 4, 5, 6];
    for (const tier of tiers) {
      const { w, h } = TIER_SIZES[tier];
      const g = new PIXI.Graphics();
      g.fill(TIER_COLORS[tier]);
      // Fish body (ellipse)
      g.ellipse(w / 2, h / 2, w / 2, h / 2);
      g.fill();
      // Tail
      g.fill(TIER_COLORS[tier]);
      g.moveTo(0, h / 4);
      g.lineTo(-w / 4, 0);
      g.lineTo(0, h * 3 / 4);
      g.closePath();
      g.fill();
      const texture = app.renderer.generateTexture(g);
      texturesRef.current.set(tier, texture);
      g.destroy();
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

      // Layer hierarchy
      const backgroundLayer = new PIXI.Container();
      const troutLayer = new PIXI.Container();
      const labelLayer = new PIXI.Container();
      app.stage.addChild(backgroundLayer);
      app.stage.addChild(troutLayer);
      app.stage.addChild(labelLayer);

      // Background — simple solid for now
      const bg = new PIXI.Graphics();
      bg.fill(0x2d6a5a);
      bg.rect(-50000, -50000, 100000, 100000);
      bg.fill();
      backgroundLayer.addChild(bg);

      // Camera
      const cam = createCamera(app.screen.width, app.screen.height);
      cameraRef.current = cam;

      // Object pool
      const pool = new SpritePool(troutLayer, 300);
      poolRef.current = pool;

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

        // Reconcile sprites
        const visible = visibleTroutsRef.current;
        const visibleSet = new Set(visible.map((t) => t.address));
        const pool = poolRef.current!;

        // Release sprites that left viewport
        pool.releaseExcept(visibleSet);

        // Determine max visible sprites based on quality
        const maxSprites = quality === "low" ? 100 : quality === "medium" ? 300 : 600;

        // Update/acquire sprites
        const count = Math.min(visible.length, maxSprites);
        for (let i = 0; i < count; i++) {
          const t = visible[i];
          const sprite = pool.acquire(t.address);
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

        pool.maybeShrink();
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
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, [createPlaceholderTextures, quality, setHoveredTrout, selectedTrout]);

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

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      style={{ touchAction: "none" }}
    />
  );
}

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
import {
  createTroutTextures,
  createShadowTextures,
  createDotTextures,
  createWaterTexture,
} from "@/lib/trout/pixel-sprites";

// Shadow offset (top-down "depth" shadow)
const SHADOW_OFFSET_X = 2;
const SHADOW_OFFSET_Y = 4;

// ─── Component ───────────────────────────────────────────────

export default function TroutScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const poolRef = useRef<SpritePool | null>(null);
  const dotPoolRef = useRef<SpritePool | null>(null);
  const shadowPoolRef = useRef<SpritePool | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const visibleTroutsRef = useRef<VisibleTrout[]>([]);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  // Texture refs
  const texturesRef = useRef<Map<TroutTier, PIXI.Texture>>(new Map());
  const dotTexturesRef = useRef<Map<TroutTier, PIXI.Texture>>(new Map());
  const shadowTexturesRef = useRef<Map<TroutTier, PIXI.Texture>>(new Map());

  const createTextures = useCallback((app: PIXI.Application) => {
    texturesRef.current = createTroutTextures(app);
    shadowTexturesRef.current = createShadowTextures(app);
    dotTexturesRef.current = createDotTextures(app);
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
        backgroundColor: 0x2a5c5a,
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

      // Generate pixel-art textures
      createTextures(app);

      // Layer hierarchy
      const backgroundLayer = new PIXI.Container();
      const dotLayer = new PIXI.Container();
      const shadowLayer = new PIXI.Container();
      const troutLayer = new PIXI.Container();
      const labelLayer = new PIXI.Container();
      app.stage.addChild(backgroundLayer);
      app.stage.addChild(dotLayer);
      app.stage.addChild(shadowLayer);
      app.stage.addChild(troutLayer);
      app.stage.addChild(labelLayer);

      // Water background — tiling texture
      const waterTex = createWaterTexture(app);
      const tilingBg = new PIXI.TilingSprite({
        texture: waterTex,
        width: 100000,
        height: 100000,
      });
      tilingBg.x = -50000;
      tilingBg.y = -50000;
      backgroundLayer.addChild(tilingBg);

      // Camera
      const cam = createCamera(app.screen.width, app.screen.height);
      cameraRef.current = cam;

      // Object pools
      const pool = new SpritePool(troutLayer, 300);
      poolRef.current = pool;
      const dotPool = new SpritePool(dotLayer, 500);
      dotPoolRef.current = dotPool;
      const shadowPool = new SpritePool(shadowLayer, 300);
      shadowPoolRef.current = shadowPool;

      // Spawn Web Worker
      const worker = new Worker(
        new URL("../../workers/trout-simulation.worker.ts", import.meta.url)
      );
      workerRef.current = worker;

      // ─── Mock trout data for development ─────────────────
      // Generate fake holders across all 6 tiers so we can see
      // the pixel-art sprites without a live database.
      {
        const mockTrouts: { address: string; x: number; y: number; tier: TroutTier; scale: number }[] = [];
        const tierCounts: Record<TroutTier, number> = { 1: 60, 2: 40, 3: 30, 4: 15, 5: 8, 6: 3 };
        const tierScales: Record<TroutTier, [number, number]> = {
          1: [0.5, 0.7],
          2: [0.7, 0.95],
          3: [0.9, 1.15],
          4: [1.1, 1.45],
          5: [1.4, 1.75],
          6: [1.8, 2.2],
        };
        let idx = 0;
        for (const tier of [1, 2, 3, 4, 5, 6] as TroutTier[]) {
          for (let i = 0; i < tierCounts[tier]; i++) {
            const [sMin, sMax] = tierScales[tier];
            mockTrouts.push({
              address: `mock_${tier}_${idx++}`,
              x: 1000 + Math.random() * 8000,
              y: 1000 + Math.random() * 4000,
              tier,
              scale: sMin + Math.random() * (sMax - sMin),
            });
          }
        }
        worker.postMessage({ type: "INIT", payload: { worldWidth: 10000, worldHeight: 6000 } });
        worker.postMessage({ type: "LOAD_TROUTS", payload: mockTrouts });
      }

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
        const sPool = shadowPoolRef.current!;

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
          // LOD mode: render as dots, release sprites and shadows
          spritePool.releaseExcept(new Set<string>());
          sPool.releaseExcept(new Set<string>());
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
          // Full sprite mode: release dots
          dPool.releaseExcept(new Set<string>());

          // Shadow key prefix to distinguish from trout sprites
          const shadowSet = new Set(visible.map((t) => "s_" + t.address));
          spritePool.releaseExcept(visibleSet);
          sPool.releaseExcept(shadowSet);

          const count = Math.min(visible.length, maxSprites);
          for (let i = 0; i < count; i++) {
            const t = visible[i];

            // Shadow sprite
            const shadowKey = "s_" + t.address;
            const shadow = sPool.acquire(shadowKey);
            const s = t.scale || 1;
            shadow.x = t.x + SHADOW_OFFSET_X * s;
            shadow.y = t.y + SHADOW_OFFSET_Y * s;
            shadow.scale.x = s;
            shadow.scale.y = s;
            const shadowTex = shadowTexturesRef.current.get(t.tier);
            if (shadowTex && shadow.texture !== shadowTex) {
              shadow.texture = shadowTex;
            }

            // Trout sprite
            const sprite = spritePool.acquire(t.address);
            sprite.x = t.x;
            sprite.y = t.y;

            const tex = texturesRef.current.get(t.tier);
            if (tex && sprite.texture !== tex) {
              sprite.texture = tex;
            }

            // Apply scale and direction (flip X for facing)
            sprite.scale.x = t.direction * s;
            sprite.scale.y = s;

            // Make interactive for hover
            sprite.eventMode = "static";
            sprite.cursor = "pointer";
          }
        }

        spritePool.maybeShrink();
        dPool.maybeShrink();
        sPool.maybeShrink();
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
  }, [createTextures]);

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
    zoomToward(cam, world.x, world.y, 500);
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

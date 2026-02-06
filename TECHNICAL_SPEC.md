# Big Trout Fish - Technical Specification

> Implementation-level technical document. For product requirements see [PRD.md](./PRD.md).

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Rendering Engine](#2-rendering-engine)
3. [Spatial Indexing & Viewport Culling](#3-spatial-indexing--viewport-culling)
4. [Object Pool System](#4-object-pool-system)
5. [Trout Sizing System](#5-trout-sizing-system)
6. [Movement & Simulation](#6-movement--simulation)
7. [Web Worker Architecture](#7-web-worker-architecture)
8. [Camera System](#8-camera-system)
9. [API Specification](#9-api-specification)
10. [Database Design](#10-database-design)
11. [Redis Cache Layer](#11-redis-cache-layer)
12. [Cron: Holder Data Sync](#12-cron-holder-data-sync)
13. [Wallet Verification Flow](#13-wallet-verification-flow)
14. [Naming System](#14-naming-system)
15. [Screenshot & Sharing](#15-screenshot--sharing)
16. [Client Data Loading Strategy](#16-client-data-loading-strategy)
17. [Mobile Adaptation](#17-mobile-adaptation)
18. [Security Considerations](#18-security-considerations)
19. [Error Handling](#19-error-handling)
20. [Dependencies & Versions](#20-dependencies--versions)
21. [Performance Budgets](#21-performance-budgets)

---

## 1. System Architecture

### 1.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                     │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  React UI    │   │  PixiJS      │   │  Web Worker    │  │
│  │  Overlays    │   │  Canvas      │   │  (Simulation)  │  │
│  │  (Tailwind)  │   │  (WebGL)     │   │                │  │
│  └──────┬───────┘   └──────┬───────┘   └───────┬────────┘  │
│         │                  │                    │           │
│         └──────────┬───────┘                    │           │
│                    │         postMessage         │           │
│                    │◄───────────────────────────►│           │
│                    │                                        │
│              ┌─────▼──────┐                                 │
│              │  State Mgr │  (Zustand or React Context)     │
│              └─────┬──────┘                                 │
│                    │                                        │
└────────────────────┼────────────────────────────────────────┘
                     │  HTTPS (fetch / SWR)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Edge + Serverless)                │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js API Routes (Edge Runtime where possible)    │   │
│  │                                                      │   │
│  │  GET /api/trouts          GET /api/leaderboard       │   │
│  │  GET /api/trouts/[addr]   GET /api/stats             │   │
│  │  POST /api/verify         POST /api/name             │   │
│  └───────┬──────────────────────────────┬───────────────┘   │
│          │                              │                   │
│          ▼                              ▼                   │
│  ┌──────────────┐              ┌──────────────┐            │
│  │  Upstash     │              │  Neon        │            │
│  │  Redis       │              │  PostgreSQL  │            │
│  │  (REST API)  │              │  (TCP/HTTP)  │            │
│  └──────────────┘              └──────────────┘            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Vercel Cron  (/api/cron/sync-holders)               │   │
│  │  Runs every 10 minutes                               │   │
│  └───────┬──────────────────────────────────────────────┘   │
│          │                                                  │
└──────────┼──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  Helius DAS API     │     │  Solana RPC          │
│  (Bulk holders)     │     │  (Verification only) │
└─────────────────────┘     └─────────────────────┘
```

### 1.2 Runtime Environments

| Component | Runtime | Rationale |
|-----------|---------|-----------|
| `/api/trouts`, `/api/leaderboard`, `/api/stats` | Vercel Edge Runtime | Low latency, close to user, Redis REST compatible |
| `/api/verify`, `/api/name` | Vercel Serverless (Node.js) | Needs `@solana/web3.js` which requires Node APIs |
| `/api/cron/sync-holders` | Vercel Serverless (Node.js) | Long-running (up to 60s), needs full Node |
| Frontend | Static + Client Components | Main page is a client-rendered SPA (canvas) |

### 1.3 State Management

Use **Zustand** for lightweight client state:

```typescript
interface TroutStore {
  // Trout data (loaded from API)
  troutMap: Map<string, TroutData>;       // address -> data
  totalCount: number;

  // Camera state
  camera: { x: number; y: number; zoom: number };

  // UI state
  selectedTrout: string | null;           // address being followed
  hoveredTrout: string | null;
  searchQuery: string;

  // Wallet state
  walletAddress: string | null;
  isVerified: boolean;

  // Device capabilities
  quality: 'low' | 'medium' | 'high';
}
```

---

## 2. Rendering Engine

### 2.1 PixiJS Application Setup

```typescript
// TroutScene.tsx - initialization
const app = new PIXI.Application();
await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x3a7d6e,        // river green-blue
  antialias: false,                   // pixel art = no AA
  resolution: window.devicePixelRatio,
  autoDensity: true,
  powerPreference: 'high-performance',
});
```

**Canvas is mounted as the page background. All UI is HTML overlaid on top via `pointer-events: none` containers with `pointer-events: auto` on interactive elements.**

### 2.2 Layer Structure

The scene is composed of ordered display containers:

```
PIXI.Application.stage
├── backgroundLayer     (Container)    z=0   — tiled river background
│   ├── bgTilesFar      (TilingSprite)       — deep water texture, parallax 0.3x
│   ├── bgTilesMid      (TilingSprite)       — mid-water texture, parallax 0.6x
│   └── bgRocks         (Container)          — static rock/plant decorations
├── troutLayer          (Container)    z=1   — all trout sprites
│   ├── smallTroutBatch (ParticleContainer)  — tier 1-2 trouts (max perf)
│   └── largeTroutGroup (Container)          — tier 3-5 trouts (full features)
├── effectsLayer        (Container)    z=2   — bubbles, ripples (post-MVP)
└── labelLayer          (Container)    z=3   — name labels (BitmapText)
```

### 2.3 Sprite Sheet Specification

**Atlas layout:** Single texture atlas containing all trout frames.

| Tier | Name | Raw Size Range | Sprite Size (px) | Frame Count | Animation |
|------|------|---------------|-------------------|-------------|-----------|
| 1 | Fry | 0 – 10 | 8×4 | 2 | Tail wiggle |
| 2 | Fingerling | 10 – 50 | 16×8 | 4 | Swim cycle |
| 3 | Juvenile | 50 – 200 | 32×16 | 4 | Swim cycle |
| 4 | Adult | 200 – 1000 | 48×24 | 6 | Swim cycle + mouth |
| 5 | Trophy | 1000 – 5000 | 64×32 | 6 | Swim cycle + mouth + fin |
| 6 | Leviathan | 5000+ | 96×48 | 8 | Full animation |

- All sprites face **right** by default. Flip `scale.x = -1` when swimming left.
- Sprite sheet format: `.png` with accompanying `.json` atlas (TexturePacker/Aseprite format).
- Each tier also has a 1px colored dot variant for extreme zoom-out LOD.

**Asset swap mechanism:**
```
public/assets/sprites/
├── trout-atlas.json       # current active atlas descriptor
├── trout-atlas.png        # current active sprite sheet
├── themes/
│   ├── default/           # built-in placeholder art
│   ├── pixel-v1/          # first artist iteration
│   └── ai-generated/      # AI-generated variant
```

At build time or via a config, the active theme is selected. The atlas filename is constant so no code changes are needed — just swap the files.

### 2.4 Rendering Modes

The renderer adapts based on zoom level and device capability:

| Zoom Level | Tiers 1-2 | Tiers 3-4 | Tiers 5-6 | Labels |
|-----------|-----------|-----------|-----------|--------|
| Far (< 0.3x) | Colored dots (1-2px) | Colored dots (3-4px) | Sprite (scaled) | Hidden |
| Medium (0.3x – 1x) | Sprite (no animation) | Animated sprite | Animated sprite | Top 50 only |
| Close (> 1x) | Animated sprite | Animated sprite | Animated sprite | All visible |

Transition between modes uses the `quality` setting from device detection:
- **High** (desktop, 8+ cores): full rendering at all zoom levels
- **Medium** (laptop, 4 cores): reduce animation frames, delay label rendering
- **Low** (mobile, < 4 cores): dots until 1x zoom, max 100 sprites, no labels at default zoom

---

## 3. Spatial Indexing & Viewport Culling

### 3.1 Spatial Hash Grid

A uniform grid divides the virtual world into fixed-size cells. Each cell stores the set of trout addresses present within it.

**Configuration:**
```typescript
const WORLD_WIDTH = 20_000;     // virtual world pixels
const WORLD_HEIGHT = 12_000;
const CELL_SIZE = 200;          // pixels per cell
const GRID_COLS = WORLD_WIDTH / CELL_SIZE;   // 100
const GRID_ROWS = WORLD_HEIGHT / CELL_SIZE;  // 60
// Total cells: 6,000
```

**Data structure:**
```typescript
class SpatialGrid {
  private cells: Map<number, Set<string>>;  // cellIndex -> Set<address>
  private entityCells: Map<string, number>; // address -> current cellIndex

  // Convert world position to cell index
  private cellIndex(x: number, y: number): number {
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    return row * GRID_COLS + col;
  }

  // Insert or update an entity
  update(address: string, x: number, y: number): void;

  // Query all entities in a rectangular region
  query(x1: number, y1: number, x2: number, y2: number): string[];

  // Remove an entity
  remove(address: string): void;
}
```

### 3.2 Viewport Query

Each frame, the visible region is computed from the camera:

```typescript
function getVisibleBounds(camera: Camera): AABB {
  const buffer = CELL_SIZE; // render one cell beyond viewport
  return {
    x1: camera.x - (camera.viewWidth / 2 / camera.zoom) - buffer,
    y1: camera.y - (camera.viewHeight / 2 / camera.zoom) - buffer,
    x2: camera.x + (camera.viewWidth / 2 / camera.zoom) + buffer,
    y2: camera.y + (camera.viewHeight / 2 / camera.zoom) + buffer,
  };
}
```

The buffer zone prevents pop-in as trouts swim into view. The spatial grid query returns all addresses in the visible cells. Only these addresses get active sprites from the object pool.

### 3.3 World Size Scaling

The world expands based on holder count to maintain reasonable density:

```typescript
function computeWorldSize(holderCount: number): { width: number; height: number } {
  // Target: ~0.12 trouts per cell at base density
  // Each trout gets roughly 1600px² average space
  const area = holderCount * 1600;
  const aspect = 5 / 3; // wide river
  const height = Math.sqrt(area / aspect);
  const width = height * aspect;
  return {
    width: Math.max(width, 4000),   // minimum 4000px wide
    height: Math.max(height, 2400), // minimum 2400px tall
  };
}
// 12,400 holders → ~18,100 × 10,900 world
// 50,000 holders → ~36,300 × 21,800 world
```

---

## 4. Object Pool System

### 4.1 Pool Design

Avoids garbage collection stalls from creating/destroying sprites:

```typescript
class SpritePool {
  private available: PIXI.AnimatedSprite[] = [];
  private active: Map<string, PIXI.AnimatedSprite> = new Map(); // address -> sprite
  private parent: PIXI.Container;
  private textures: Record<TroutTier, PIXI.Texture[]>;

  constructor(parent: PIXI.Container, initialSize: number);

  // Get a sprite from the pool (or create if empty)
  acquire(address: string, tier: TroutTier): PIXI.AnimatedSprite;

  // Return a sprite to the pool
  release(address: string): void;

  // Pre-warm the pool
  prewarm(count: number): void;

  get activeCount(): number;
  get poolSize(): number;
}
```

### 4.2 Pool Sizing

```
Initial pool size: max(500, estimatedVisibleTrouts * 1.5)
Pool grows on demand if exhausted (allocate 50 more at a time)
Pool shrinks if > 2x active count for 30+ seconds
```

### 4.3 Frame Update Cycle

```
Each requestAnimationFrame:
1. Get visible bounds from camera
2. Query spatial grid → visibleAddresses (Set<string>)
3. For each currently active sprite:
   - If address NOT in visibleAddresses → release to pool
4. For each address in visibleAddresses:
   - If NOT in active sprites → acquire from pool, set position/tier
5. Update all active sprite positions from simulation data
6. Update animation frames
```

---

## 5. Trout Sizing System

### 5.1 Raw Score Calculation

```typescript
function computeTroutScore(tokensHeld: number, daysHeld: number): number {
  // tokensHeld: human-readable token amount (after decimal adjustment)
  // daysHeld: integer days since first_seen
  return Math.sqrt(tokensHeld) * Math.sqrt(Math.max(daysHeld, 1));
}
```

### 5.2 Score to Tier Mapping

Tiers are assigned using percentile-based thresholds computed during each data sync. This ensures even distribution regardless of the token's price or holder changes.

```typescript
function assignTier(score: number, thresholds: TierThresholds): TroutTier {
  if (score >= thresholds.p99) return 6; // Leviathan  — top 1%
  if (score >= thresholds.p95) return 5; // Trophy     — top 5%
  if (score >= thresholds.p80) return 4; // Adult      — top 20%
  if (score >= thresholds.p50) return 3; // Juvenile   — top 50%
  if (score >= thresholds.p20) return 2; // Fingerling — top 80%
  return 1;                               // Fry        — bottom 20%
}

interface TierThresholds {
  p20: number;
  p50: number;
  p80: number;
  p95: number;
  p99: number;
}
```

Thresholds are recomputed by the cron job and stored in Redis (`trout:thresholds`).

### 5.3 Visual Scale

Within each tier, a continuous scale multiplier provides visual variation:

```typescript
function computeVisualScale(score: number, tier: TroutTier, thresholds: TierThresholds): number {
  const tierMin = getTierMin(tier, thresholds);
  const tierMax = getTierMax(tier, thresholds);
  const t = Math.min((score - tierMin) / (tierMax - tierMin), 1); // 0..1 within tier
  const baseScale = TIER_BASE_SCALES[tier]; // e.g. { 1: 0.5, 2: 0.8, 3: 1.0, 4: 1.3, 5: 1.6, 6: 2.0 }
  return baseScale + t * 0.3; // slight variation within tier
}
```

---

## 6. Movement & Simulation

### 6.1 Movement Model

Each trout is a simple agent with waypoint-based movement:

```typescript
interface TroutSimState {
  address: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;           // pixels per second
  direction: 1 | -1;      // 1 = right, -1 = left
  tier: TroutTier;
  nextWaypointTime: number; // ms timestamp for next target change
}
```

### 6.2 Speed by Tier

```typescript
const TIER_SPEEDS: Record<TroutTier, { min: number; max: number }> = {
  1: { min: 60, max: 100 },  // Fry: fast and darty
  2: { min: 45, max: 75 },
  3: { min: 30, max: 55 },
  4: { min: 20, max: 40 },
  5: { min: 12, max: 25 },
  6: { min: 8, max: 15 },    // Leviathan: slow and majestic
};
```

### 6.3 Waypoint Selection

```typescript
function pickNextWaypoint(state: TroutSimState, worldBounds: AABB): void {
  const wanderRadius = TIER_WANDER_RADIUS[state.tier]; // bigger fish wander further
  const angle = Math.random() * Math.PI * 2;
  const dist = wanderRadius * (0.5 + Math.random() * 0.5);

  state.targetX = clamp(state.x + Math.cos(angle) * dist, worldBounds.x1, worldBounds.x2);
  state.targetY = clamp(state.y + Math.sin(angle) * dist, worldBounds.y1, worldBounds.y2);

  // Face direction of travel
  state.direction = state.targetX > state.x ? 1 : -1;

  // Time until next waypoint: based on distance and speed
  const travelTime = dist / state.speed;
  state.nextWaypointTime = Date.now() + travelTime * 1000 + Math.random() * 2000; // + idle pause
}
```

### 6.4 Position Update (per tick)

```typescript
function updatePosition(state: TroutSimState, deltaSeconds: number): void {
  const dx = state.targetX - state.x;
  const dy = state.targetY - state.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 2 || Date.now() > state.nextWaypointTime) {
    pickNextWaypoint(state, worldBounds);
    return;
  }

  // Smooth interpolation toward target
  const step = state.speed * deltaSeconds;
  const ratio = Math.min(step / dist, 1);
  state.x += dx * ratio;
  state.y += dy * ratio;
}
```

### 6.5 Deterministic Seeding

To avoid all trouts moving in sync on page load, initial positions and waypoints are seeded from a hash of the wallet address:

```typescript
function seedFromAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash + address.charCodeAt(i)) | 0;
  }
  return (hash >>> 0) / 0xFFFFFFFF; // normalize to 0..1
}

// Usage: initial position
const seed = seedFromAddress(address);
state.x = seed * worldWidth;
state.y = ((seed * 16807) % 1) * worldHeight; // LCG for second value
```

---

## 7. Web Worker Architecture

### 7.1 Communication Protocol

The main thread and Web Worker communicate via `postMessage` with typed messages:

```typescript
// Messages: Main Thread → Worker
type MainToWorkerMessage =
  | { type: 'INIT'; payload: { worldWidth: number; worldHeight: number } }
  | { type: 'LOAD_TROUTS'; payload: TroutData[] }
  | { type: 'UPDATE_TROUT'; payload: TroutData }
  | { type: 'REMOVE_TROUT'; payload: { address: string } }
  | { type: 'SET_VIEWPORT'; payload: AABB }
  | { type: 'TICK'; payload: { deltaMs: number } };

// Messages: Worker → Main Thread
type WorkerToMainMessage =
  | { type: 'VISIBLE_TROUTS'; payload: VisibleTrout[] }
  | { type: 'STATS'; payload: { totalCount: number; visibleCount: number } };

interface VisibleTrout {
  address: string;
  x: number;
  y: number;
  direction: 1 | -1;
  tier: TroutTier;
  scale: number;
  animFrame: number;  // which animation frame to display
}
```

### 7.2 Worker Loop

The worker runs a simulation tick on every `TICK` message (driven by rAF on main thread):

```
Main thread (60fps rAF loop):
  1. Send { type: 'TICK', deltaMs } to worker
  2. Send { type: 'SET_VIEWPORT', bounds } if camera moved

Worker (on TICK):
  1. Update all 12k+ trout positions (simple math, no DOM)
  2. Update spatial grid
  3. Query spatial grid with last known viewport
  4. Send { type: 'VISIBLE_TROUTS', [...] } back to main thread

Main thread (on VISIBLE_TROUTS):
  1. Reconcile sprites via object pool
  2. Render frame
```

### 7.3 Transfer Optimization

For the `VISIBLE_TROUTS` response, use a `SharedArrayBuffer` or `Float32Array` with `Transferable` to avoid serialization overhead:

```typescript
// Worker side: pack visible trouts into a Float32Array
// Layout per trout: [x, y, direction, tier, scale, animFrame] = 6 floats
const FLOATS_PER_TROUT = 6;
const buffer = new Float32Array(visibleCount * FLOATS_PER_TROUT);
// ... fill buffer ...
postMessage({ type: 'VISIBLE_TROUTS', buffer, count: visibleCount }, [buffer.buffer]);
```

Additionally, an `addressList: string[]` is sent alongside (addresses can't be packed into float arrays). This is only sent when the visible set changes — the buffer is sent every frame.

### 7.4 Fallback (No Worker Support)

If `window.Worker` is unavailable, simulation runs synchronously on the main thread with a reduced tick rate (30fps) and a maximum active trout count of 200.

---

## 8. Camera System

### 8.1 Camera State

```typescript
interface CameraState {
  x: number;           // world-space center X
  y: number;           // world-space center Y
  zoom: number;        // 1.0 = default, 0.1 = far out, 3.0 = close up
  targetX: number;     // for smooth pan animation
  targetY: number;
  targetZoom: number;
}

const ZOOM_MIN = 0.05;   // see entire world
const ZOOM_MAX = 4.0;    // close-up on individual trouts
const ZOOM_DEFAULT = 0.3; // starting zoom (overview)
const PAN_LERP = 0.08;   // smoothing factor per frame
const ZOOM_LERP = 0.1;
```

### 8.2 Input Handling

| Input | Action |
|-------|--------|
| Mouse drag (left button) | Pan camera |
| Scroll wheel | Zoom toward cursor position |
| Pinch (touch) | Zoom toward pinch center |
| Touch drag (single) | Pan camera |
| Double-click/tap | Zoom in 2x at point |
| Escape | Stop following, reset to default zoom |

**Zoom toward point** (keeps the point under the cursor stationary):

```typescript
function zoomToward(camera: CameraState, worldX: number, worldY: number, delta: number): void {
  const oldZoom = camera.targetZoom;
  camera.targetZoom = clamp(oldZoom * (1 + delta * 0.001), ZOOM_MIN, ZOOM_MAX);
  const scale = camera.targetZoom / oldZoom;
  camera.targetX = worldX - (worldX - camera.targetX) * scale;
  camera.targetY = worldY - (worldY - camera.targetY) * scale;
}
```

### 8.3 Follow Mode

When following a trout, the camera smoothly tracks its position:

```typescript
function updateFollowCamera(camera: CameraState, trout: VisibleTrout): void {
  camera.targetX = trout.x;
  camera.targetY = trout.y;
  camera.targetZoom = Math.max(camera.targetZoom, 1.5); // zoom in enough to see the trout
}
```

### 8.4 Applying Camera to PixiJS

```typescript
function applyCamera(stage: PIXI.Container, camera: CameraState, screenW: number, screenH: number): void {
  // Smooth interpolation
  camera.x += (camera.targetX - camera.x) * PAN_LERP;
  camera.y += (camera.targetY - camera.y) * PAN_LERP;
  camera.zoom += (camera.targetZoom - camera.zoom) * ZOOM_LERP;

  stage.scale.set(camera.zoom);
  stage.x = screenW / 2 - camera.x * camera.zoom;
  stage.y = screenH / 2 - camera.y * camera.zoom;
}
```

---

## 9. API Specification

### 9.1 `GET /api/trouts`

Fetch trout data for rendering. Supports viewport-based queries.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `bbox` | string | No | Viewport bounds: `x1,y1,x2,y2` (world coordinates) |
| `limit` | number | No | Max trouts to return (default: 500, max: 1000) |
| `cursor` | string | No | Pagination cursor for next batch |

**Response: `200 OK`**

```json
{
  "trouts": [
    {
      "address": "Ab3x...9fZ2",
      "displayName": "TroutKing",
      "balance": 1500000,
      "firstSeen": "2025-12-01T00:00:00Z",
      "daysHeld": 67,
      "score": 316.2,
      "tier": 4,
      "rank": 342,
      "x": 5420.5,
      "y": 3210.8
    }
  ],
  "nextCursor": "eyJvZmZzZXQiOjUwMH0=",
  "total": 12400
}
```

**Caching:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

### 9.2 `GET /api/trouts/[address]`

Fetch a single trout by Solana address.

**Response: `200 OK`**

```json
{
  "address": "Ab3x...9fZ2",
  "displayName": "TroutKing",
  "balance": 1500000,
  "firstSeen": "2025-12-01T00:00:00Z",
  "daysHeld": 67,
  "score": 316.2,
  "tier": 4,
  "rank": 342,
  "x": 5420.5,
  "y": 3210.8
}
```

**Response: `404 Not Found`**

```json
{ "error": "Trout not found" }
```

### 9.3 `GET /api/leaderboard`

Paginated leaderboard sorted by trout score descending.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 50, max: 100) |
| `search` | string | No | Filter by address or display name (partial match) |

**Response: `200 OK`**

```json
{
  "entries": [
    {
      "rank": 1,
      "address": "Wh4l...eXyz",
      "displayName": null,
      "balance": 50000000,
      "daysHeld": 90,
      "score": 2121.3,
      "tier": 6
    }
  ],
  "page": 1,
  "totalPages": 248,
  "totalEntries": 12400
}
```

### 9.4 `POST /api/verify`

Verify wallet ownership via Phantom signature.

**Request Body:**

```json
{
  "address": "Ab3x...9fZ2",
  "message": "Sign this message to verify your Big Trout: Ab3x...9fZ2\nTimestamp: 1706140800000\nNonce: a1b2c3d4",
  "signature": "base58-encoded-signature"
}
```

**Validation:**
1. Decode the base58 signature
2. Verify the signature against the message using `@solana/web3.js` `PublicKey` and `nacl.sign.detached.verify`
3. Confirm the address exists in the `holders` table
4. Confirm the timestamp in the message is within the last 5 minutes
5. Store a verification session token (JWT, 24h expiry)

**Response: `200 OK`**

```json
{
  "verified": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "trout": {
    "address": "Ab3x...9fZ2",
    "displayName": null,
    "tier": 4,
    "rank": 342
  }
}
```

**Response: `401 Unauthorized`**

```json
{ "error": "Invalid signature" }
```

**Response: `404 Not Found`**

```json
{ "error": "Address is not a token holder" }
```

### 9.5 `POST /api/name`

Set or update the custom display name.

**Request Headers:**
```
Authorization: Bearer <jwt-token-from-verify>
```

**Request Body:**

```json
{
  "displayName": "TroutKing"
}
```

**Validation:**
1. Verify JWT token is valid and not expired
2. Extract address from JWT claims
3. Validate name:
   - Length: 1-20 characters
   - Pattern: `/^[a-zA-Z0-9_\-\.]+$/`
   - Not in profanity list (server-side check)
   - Not already taken by another address (case-insensitive uniqueness)
4. Upsert into `custom_names` table
5. Invalidate Redis cache for this address

**Response: `200 OK`**

```json
{
  "displayName": "TroutKing",
  "address": "Ab3x...9fZ2"
}
```

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Name too long (max 20 chars)" }` | Length exceeded |
| 400 | `{ "error": "Invalid characters" }` | Regex mismatch |
| 400 | `{ "error": "Name contains inappropriate content" }` | Profanity filter hit |
| 409 | `{ "error": "Name already taken" }` | Uniqueness conflict |
| 401 | `{ "error": "Invalid or expired token" }` | JWT failure |

### 9.6 `GET /api/stats`

Global statistics for the stats bar overlay.

**Response: `200 OK`**

```json
{
  "totalHolders": 12400,
  "totalSupplyHeld": 980000000,
  "avgDaysHeld": 34.2,
  "largestTrout": {
    "address": "Wh4l...eXyz",
    "displayName": "MegaTrout",
    "score": 2121.3
  },
  "oldestTrout": {
    "address": "OG4x...1234",
    "displayName": null,
    "daysHeld": 120
  },
  "lastUpdated": "2026-02-06T10:30:00Z"
}
```

**Caching:** `Cache-Control: public, s-maxage=120, stale-while-revalidate=600`

### 9.7 `POST /api/cron/sync-holders`

Triggered by Vercel Cron. Protected by `CRON_SECRET`.

**Request Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Behavior:**
See [Section 12: Cron Holder Data Sync](#12-cron-holder-data-sync).

**Response: `200 OK`**

```json
{
  "synced": 12400,
  "added": 15,
  "removed": 3,
  "updated": 230,
  "duration": 8420
}
```

---

## 10. Database Design

### 10.1 PostgreSQL Schema (Drizzle ORM)

```typescript
// src/lib/db/schema.ts
import { pgTable, varchar, bigint, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const holders = pgTable('holders', {
  address: varchar('address', { length: 44 }).primaryKey(),
  balance: bigint('balance', { mode: 'number' }).notNull(),
  firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_holders_balance').on(table.balance),
  index('idx_holders_first_seen').on(table.firstSeen),
]);

export const customNames = pgTable('custom_names', {
  address: varchar('address', { length: 44 })
    .primaryKey()
    .references(() => holders.address, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 20 }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_custom_names_display_name_lower')
    .on(sql`lower(${table.displayName})`),
]);
```

### 10.2 Migrations

Use Drizzle Kit for migrations:

```bash
npx drizzle-kit generate   # generate SQL migration files
npx drizzle-kit migrate     # apply migrations
```

### 10.3 Key Queries

**Leaderboard query (with computed score):**

```sql
SELECT
  h.address,
  cn.display_name,
  h.balance,
  EXTRACT(EPOCH FROM (NOW() - h.first_seen)) / 86400 AS days_held,
  SQRT(h.balance::float / 1e9) * SQRT(GREATEST(EXTRACT(EPOCH FROM (NOW() - h.first_seen)) / 86400, 1)) AS score
FROM holders h
LEFT JOIN custom_names cn ON cn.address = h.address
ORDER BY score DESC
LIMIT $1 OFFSET $2;
```

> Note: `balance / 1e9` assumes 9 decimal places for the SPL token. Adjust based on actual token decimals.

**Search query:**

```sql
SELECT h.address, cn.display_name, h.balance, h.first_seen
FROM holders h
LEFT JOIN custom_names cn ON cn.address = h.address
WHERE h.address ILIKE $1 || '%'
   OR cn.display_name ILIKE '%' || $1 || '%'
LIMIT 20;
```

---

## 11. Redis Cache Layer

### 11.1 Provider: Upstash Redis

Upstash provides REST-based Redis compatible with Vercel Edge Runtime (no TCP needed).

Use `@upstash/redis` SDK.

### 11.2 Key Schema

| Key Pattern | Type | TTL | Description |
|------------|------|-----|-------------|
| `trout:all` | Sorted Set | 12 min | All addresses scored by trout score. `ZREVRANGE` for leaderboard. |
| `trout:data:{address}` | Hash | 12 min | `{ balance, firstSeen, score, tier, rank, displayName, x, y }` |
| `trout:thresholds` | String (JSON) | 12 min | Percentile thresholds for tier assignment |
| `trout:stats` | String (JSON) | 12 min | Global stats object |
| `trout:names` | Hash | No TTL | `{ displayName -> address }` for uniqueness checks |
| `trout:sync:lock` | String | 5 min | Mutex to prevent concurrent cron runs |
| `trout:sync:last` | String | No TTL | ISO timestamp of last successful sync |

### 11.3 Cache Population (on Cron Sync)

```typescript
async function populateCache(holders: HolderRow[], names: NameRow[]): Promise<void> {
  const pipeline = redis.pipeline();
  const nameMap = new Map(names.map(n => [n.address, n.displayName]));

  // Compute all scores and sort for ranking
  const scored = holders.map(h => {
    const daysHeld = daysSince(h.firstSeen);
    const score = Math.sqrt(h.balance / TOKEN_DECIMALS) * Math.sqrt(Math.max(daysHeld, 1));
    return { ...h, daysHeld, score };
  }).sort((a, b) => b.score - a.score);

  // Compute tier thresholds
  const thresholds = computeThresholds(scored.map(s => s.score));
  pipeline.set('trout:thresholds', JSON.stringify(thresholds), { ex: 720 });

  // Populate sorted set and individual hashes
  for (let i = 0; i < scored.length; i++) {
    const s = scored[i];
    const tier = assignTier(s.score, thresholds);
    const { x, y } = computeStablePosition(s.address, worldWidth, worldHeight);

    pipeline.zadd('trout:all', { score: s.score, member: s.address });
    pipeline.hset(`trout:data:${s.address}`, {
      balance: s.balance.toString(),
      firstSeen: s.firstSeen.toISOString(),
      score: s.score.toFixed(2),
      tier: tier.toString(),
      rank: (i + 1).toString(),
      displayName: nameMap.get(s.address) || '',
      x: x.toFixed(1),
      y: y.toFixed(1),
    });
    pipeline.expire(`trout:data:${s.address}`, 720);
  }

  pipeline.expire('trout:all', 720);
  await pipeline.exec();
}
```

### 11.4 Cache Read Patterns

**Viewport query (Edge API route):**
```typescript
// Get all addresses (from sorted set), filter by position client-side
// OR pre-bucket into spatial cells during sync:
async function getTroutsInViewport(bbox: AABB): Promise<TroutData[]> {
  // Option A: Fetch top N by score, client does spatial filtering
  const addresses = await redis.zrevrange('trout:all', 0, -1);

  // Option B: Spatial cells (more complex but scales better)
  // Fetch addresses from relevant grid cells stored in Redis sets
  const cellKeys = getCellKeysForBBox(bbox);
  const addresses = await Promise.all(cellKeys.map(k => redis.smembers(k)));

  // Fetch data for visible addresses
  const pipeline = redis.pipeline();
  addresses.flat().forEach(addr => pipeline.hgetall(`trout:data:${addr}`));
  return pipeline.exec();
}
```

---

## 12. Cron: Holder Data Sync

### 12.1 Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync-holders",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

### 12.2 Sync Algorithm

```
1. Acquire Redis lock (`trout:sync:lock`, 5 min TTL)
   - If lock exists → abort (previous sync still running)

2. Fetch current holder list from Helius DAS API
   - GET /v0/token/holders?mint=<TOKEN_MINT>&limit=1000&cursor=...
   - Paginate through all holders
   - Result: Map<address, balance>

3. Fetch current holders from PostgreSQL
   - SELECT address, balance, first_seen FROM holders

4. Compute diff:
   - NEW: in API but not in DB → INSERT with first_seen = NOW()
   - REMOVED: in DB but not in API → DELETE (balance dropped to 0)
   - CHANGED: balance differs → UPDATE balance, last_updated = NOW()
   - UNCHANGED: skip

5. Apply diff to PostgreSQL (batched upserts, 500 per batch)

6. Fetch all custom_names from PostgreSQL

7. Recompute all scores and populate Redis cache (see 11.3)

8. Update `trout:stats` with aggregated statistics

9. Set `trout:sync:last` = NOW()

10. Release Redis lock
```

### 12.3 Helius DAS API Integration

```typescript
interface HeliusHolderResponse {
  result: {
    token_accounts: Array<{
      address: string;       // token account address
      owner: string;         // wallet address (this is what we want)
      amount: number;
      decimals: number;
    }>;
    cursor: string | null;
  };
}

async function fetchAllHolders(): Promise<Map<string, number>> {
  const holders = new Map<string, number>();
  let cursor: string | null = null;

  do {
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'holders',
        method: 'getTokenAccounts',
        params: {
          mint: TOKEN_MINT_ADDRESS,
          limit: 1000,
          cursor,
        },
      }),
    });

    const data: HeliusHolderResponse = await response.json();
    for (const account of data.result.token_accounts) {
      // Aggregate by owner (wallet may have multiple token accounts)
      const existing = holders.get(account.owner) || 0;
      holders.set(account.owner, existing + account.amount);
    }
    cursor = data.result.cursor;
  } while (cursor);

  return holders;
}
```

### 12.4 Timeout Handling

Vercel Serverless has a 60s timeout (Pro plan: 300s). For 12k holders:
- Helius API: ~13 pages × ~500ms = ~6.5s
- DB diff computation: ~1s
- DB writes (25 batches × 100ms): ~2.5s
- Redis population (12k pipeline): ~3s
- **Total: ~13s** (well within 60s limit)

At 50k holders, this grows to ~40s. If it approaches limits, split into chunked syncs.

---

## 13. Wallet Verification Flow

### 13.1 Sequence Diagram

```
User                    Frontend                  Backend                  Solana
 │                         │                         │                       │
 │  Click "Find My Trout"  │                         │                       │
 │────────────────────────>│                         │                       │
 │                         │                         │                       │
 │   Phantom connect popup │                         │                       │
 │<────────────────────────│                         │                       │
 │                         │                         │                       │
 │   Approve connection    │                         │                       │
 │────────────────────────>│                         │                       │
 │                         │                         │                       │
 │                         │  Construct message:     │                       │
 │                         │  "Sign this message..." │                       │
 │                         │  + timestamp + nonce    │                       │
 │                         │                         │                       │
 │   Sign message popup    │                         │                       │
 │<────────────────────────│                         │                       │
 │                         │                         │                       │
 │   Approve signature     │                         │                       │
 │────────────────────────>│                         │                       │
 │                         │                         │                       │
 │                         │  POST /api/verify       │                       │
 │                         │  { address, message,    │                       │
 │                         │    signature }           │                       │
 │                         │────────────────────────>│                       │
 │                         │                         │                       │
 │                         │                         │  nacl.sign.detached  │
 │                         │                         │  .verify(message,    │
 │                         │                         │   signature, pubkey) │
 │                         │                         │                       │
 │                         │                         │  Check holders table │
 │                         │                         │                       │
 │                         │                         │  Issue JWT (24h)     │
 │                         │                         │                       │
 │                         │  { verified, token,     │                       │
 │                         │    trout }               │                       │
 │                         │<────────────────────────│                       │
 │                         │                         │                       │
 │  Show rename UI +       │                         │                       │
 │  camera follows trout   │                         │                       │
 │<────────────────────────│                         │                       │
```

### 13.2 Message Format

```
Sign this message to verify your Big Trout: <address>
Timestamp: <unix_ms>
Nonce: <random_hex_16>
```

- Timestamp must be within 5 minutes of server time
- Nonce prevents replay attacks
- Message is human-readable (Phantom displays it to the user)

### 13.3 JWT Claims

```json
{
  "sub": "Ab3x...9fZ2",
  "iat": 1706140800,
  "exp": 1706227200,
  "iss": "bigtrout.fish"
}
```

Signed with `HS256` using a server-side `JWT_SECRET` env var. Token stored in `localStorage` on the client.

---

## 14. Naming System

### 14.1 Validation Pipeline

```typescript
import { Filter } from 'bad-words';

const NAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;
const NAME_MAX_LENGTH = 20;
const NAME_MIN_LENGTH = 1;
const profanityFilter = new Filter();

interface NameValidationResult {
  valid: boolean;
  error?: string;
}

function validateDisplayName(name: string): NameValidationResult {
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    return { valid: false, error: `Name must be ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters` };
  }

  if (!NAME_REGEX.test(name)) {
    return { valid: false, error: 'Only letters, numbers, underscores, hyphens, and dots allowed' };
  }

  if (profanityFilter.isProfane(name)) {
    return { valid: false, error: 'Name contains inappropriate content' };
  }

  return { valid: true };
}
```

### 14.2 Uniqueness Check

Case-insensitive uniqueness enforced at both application and database level:

```typescript
async function isNameAvailable(displayName: string, currentAddress: string): Promise<boolean> {
  // Check Redis first (fast path)
  const existingAddr = await redis.hget('trout:names', displayName.toLowerCase());
  if (existingAddr && existingAddr !== currentAddress) return false;

  // Confirm with PostgreSQL (source of truth)
  const existing = await db.query.customNames.findFirst({
    where: sql`lower(display_name) = ${displayName.toLowerCase()} AND address != ${currentAddress}`,
  });

  return !existing;
}
```

### 14.3 Name Update Flow

```
1. Validate JWT → extract address
2. Validate name format (regex, length, profanity)
3. Check uniqueness (Redis → PostgreSQL)
4. Upsert into custom_names table
5. Update Redis hash: trout:data:{address}.displayName
6. Update Redis hash: trout:names (remove old name, add new name)
7. Return success
```

---

## 15. Screenshot & Sharing

### 15.1 Canvas Capture

```typescript
async function captureScreenshot(): Promise<Blob> {
  const app = getPixiApp();

  // Render current frame to a RenderTexture
  const renderTexture = PIXI.RenderTexture.create({
    width: app.screen.width,
    height: app.screen.height,
  });
  app.renderer.render(app.stage, { renderTexture });

  // Extract pixels
  const canvas = app.renderer.extract.canvas(renderTexture);

  // Add watermark overlay
  const ctx = canvas.getContext('2d')!;
  ctx.font = '16px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('bigtrout.fish', canvas.width - 150, canvas.height - 20);

  // Convert to blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
```

### 15.2 Share to X/Twitter

```typescript
function shareToTwitter(address: string, displayName: string | null): void {
  const name = displayName || `${address.slice(0, 4)}...${address.slice(-4)}`;
  const text = encodeURIComponent(
    `Check out my trout "${name}" swimming in the Big Trout pond! 🐟\n\nhttps://bigtrout.fish/?trout=${address}`
  );
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}
```

### 15.3 Deep Link

`/?trout=<address>` query param triggers:
1. Load the scene normally
2. After initial data load, find the trout's position
3. Animate camera to the trout
4. Enter follow mode
5. Show tooltip

---

## 16. Client Data Loading Strategy

### 16.1 Initial Load Sequence

```
1. Page loads → mount PixiJS canvas with background only
2. Show loading indicator ("Counting trouts...")
3. Fetch GET /api/stats → display total count
4. Fetch GET /api/trouts?limit=1000 (first batch, sorted by score desc)
   → Send to Web Worker → start rendering biggest trouts first
5. Continue fetching remaining batches in background:
   GET /api/trouts?cursor=<next>&limit=1000
   → Stream each batch to Web Worker
6. Once all loaded, hide loading indicator
7. Check URL for ?trout=<address> deep link → navigate if present
```

### 16.2 Data Refresh

- SWR with `refreshInterval: 60_000` (60 seconds) for `/api/stats`
- Full trout data refreshed every 5 minutes (background fetch, merge into worker)
- On tab visibility change (`visibilitychange` event): refetch if stale > 2 minutes

### 16.3 Bandwidth Estimate

Per trout payload: ~150 bytes (address + numbers + name).
- 12,400 trouts × 150 bytes = ~1.8 MB (uncompressed)
- With gzip: ~400-500 KB
- Loaded in 1000-item pages: 13 requests × ~40 KB each

---

## 17. Mobile Adaptation

### 17.1 Device Detection

```typescript
interface DeviceCapabilities {
  cores: number;
  memory: number | undefined;  // navigator.deviceMemory (Chrome only)
  isMobile: boolean;
  isTouchDevice: boolean;
  pixelRatio: number;
  screenWidth: number;
}

function detectQuality(device: DeviceCapabilities): 'low' | 'medium' | 'high' {
  if (device.isMobile || (device.cores <= 2)) return 'low';
  if (device.cores <= 4 || (device.memory && device.memory <= 4)) return 'medium';
  return 'high';
}
```

### 17.2 Quality Presets

| Setting | Low (Mobile) | Medium (Laptop) | High (Desktop) |
|---------|-------------|-----------------|----------------|
| Max visible sprites | 100 | 300 | 600 |
| Animation frames | 2 (all tiers) | Full (tiers 3+) | Full |
| Labels shown | 0 at default zoom | Top 20 | All visible |
| LOD dot threshold | zoom < 1.0 | zoom < 0.3 | zoom < 0.15 |
| Target FPS | 30 | 60 | 60 |
| Particle effects | Off | Minimal | Full |
| Background parallax | Static | 2 layers | 3 layers |

### 17.3 Mobile UI Adjustments

- Search bar collapses to an icon, expands on tap
- Tooltip becomes a bottom sheet instead of a floating panel
- Zoom controls are larger touch targets (+/- buttons)
- "Best on desktop" banner shown once, dismissible, saved to localStorage

---

## 18. Security Considerations

### 18.1 Wallet Verification

- **Signature replay:** Prevented by timestamp (5 min window) + nonce in signed message
- **JWT security:** HS256 with strong secret, 24h expiry, no refresh tokens
- **Address spoofing:** Signature verification is cryptographic — cannot forge without private key

### 18.2 API Security

- **Rate limiting:** Vercel's built-in rate limiting + custom middleware:
  - `/api/verify`: 5 requests/min per IP
  - `/api/name`: 3 requests/min per IP
  - `/api/trouts`: 30 requests/min per IP
- **Cron endpoint:** Protected by `CRON_SECRET` header, reject if missing/invalid
- **Input validation:** All inputs sanitized server-side (address format, name regex, etc.)
- **SQL injection:** Prevented by Drizzle ORM parameterized queries (never raw string concat)

### 18.3 Content Security

- **Profanity filter:** Applied server-side on name set/update
- **XSS:** Display names are rendered as PixiJS BitmapText (not innerHTML). Overlay UI uses React (auto-escapes). No `dangerouslySetInnerHTML`.
- **CORS:** API routes only respond to same-origin requests (Vercel default)

### 18.4 Environment Variables

All secrets stored in Vercel Environment Variables (encrypted at rest):
- `JWT_SECRET` — 256-bit random, generated via `openssl rand -hex 32`
- `CRON_SECRET` — separate 256-bit random
- `DATABASE_URL`, `REDIS_URL`, `HELIUS_API_KEY` — provider-issued

---

## 19. Error Handling

### 19.1 Client Error Strategy

| Scenario | Behavior |
|----------|----------|
| API fetch fails | Show toast "Unable to load trout data. Retrying..." + exponential backoff (1s, 2s, 4s, max 30s) |
| WebGL not supported | Fallback message: "Your browser doesn't support WebGL. Try Chrome or Firefox." |
| Web Worker fails | Run simulation on main thread with reduced trout count |
| Phantom not installed | Show link to install Phantom wallet |
| Wallet connection rejected | Show message "Connection cancelled. Try again when ready." |
| Signature rejected | Show message "Verification cancelled." |

### 19.2 Server Error Strategy

| Scenario | Behavior |
|----------|----------|
| Redis unavailable | Fall back to PostgreSQL direct queries (slower). Log alert. |
| PostgreSQL unavailable | Return 503 with `Retry-After: 60` header |
| Helius API down | Skip cron sync, keep serving stale Redis data. Log alert. |
| Cron timeout | Lock auto-expires after 5 min, next cron will retry |
| Concurrent cron runs | Second run sees lock, aborts gracefully |

### 19.3 Logging

Use Vercel's built-in logging (visible in dashboard). Key log events:
- Cron sync: start, completion (with counts), failure
- Verification attempts: success/failure (no PII beyond address)
- Name changes: address + old name → new name
- Cache misses: track Redis miss rate

---

## 20. Dependencies & Versions

### 20.1 Core Dependencies

```json
{
  "dependencies": {
    "next": "^15.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "pixi.js": "^8.x",
    "@solana/web3.js": "^1.95.x",
    "@solana/wallet-adapter-base": "^0.9.x",
    "@solana/wallet-adapter-react": "^0.15.x",
    "@solana/wallet-adapter-phantom": "^0.9.x",
    "@upstash/redis": "^1.x",
    "drizzle-orm": "^0.36.x",
    "@neondatabase/serverless": "^0.10.x",
    "zustand": "^5.x",
    "swr": "^2.x",
    "jose": "^5.x",
    "bad-words": "^4.x",
    "tweetnacl": "^1.0.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tailwindcss": "^4.x",
    "drizzle-kit": "^0.28.x",
    "eslint": "^9.x",
    "eslint-config-next": "^15.x"
  }
}
```

### 20.2 Why Each Dependency

| Package | Purpose |
|---------|---------|
| `pixi.js` v8 | WebGL 2D rendering engine. v8 has improved performance and modern API. |
| `@upstash/redis` | REST-based Redis client that works in Vercel Edge Runtime |
| `@neondatabase/serverless` | Neon's HTTP/WebSocket PostgreSQL driver for serverless |
| `drizzle-orm` | Type-safe SQL ORM, lightweight, no code generation needed |
| `zustand` | Minimal state management (< 1KB), no boilerplate |
| `swr` | Data fetching with caching, revalidation, and deduplication |
| `jose` | JWT creation/verification for Edge Runtime (no Node crypto dependency) |
| `tweetnacl` | Ed25519 signature verification for Solana wallet signatures |
| `bad-words` | Profanity detection for display names |

---

## 21. Performance Budgets

### 21.1 Bundle Size

| Target | Budget |
|--------|--------|
| First Load JS | < 200 KB (gzipped) |
| PixiJS (tree-shaken) | < 150 KB (gzipped) |
| Total page weight (no assets) | < 400 KB |
| Sprite sheet (all tiers) | < 100 KB (PNG) |
| Background tiles | < 200 KB total |

### 21.2 Runtime Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to First Paint | < 1.5s | Lighthouse |
| Time to Interactive (canvas ready) | < 3s | Custom performance mark |
| Time to Full Load (all trouts) | < 8s | Custom performance mark |
| FPS (desktop, 500 visible) | 60fps sustained | `requestAnimationFrame` counter |
| FPS (mobile, 100 visible) | 30fps sustained | `requestAnimationFrame` counter |
| Memory (desktop) | < 200 MB | `performance.memory` |
| Memory (mobile) | < 100 MB | Estimated |
| Web Worker message latency | < 5 ms | `performance.now()` delta |

### 21.3 API Latency

| Endpoint | Target (p50) | Target (p99) |
|----------|-------------|-------------|
| `GET /api/trouts` | 30 ms | 100 ms |
| `GET /api/leaderboard` | 20 ms | 80 ms |
| `GET /api/stats` | 10 ms | 50 ms |
| `POST /api/verify` | 100 ms | 500 ms |
| `POST /api/name` | 50 ms | 200 ms |
| `POST /api/cron/sync-holders` | 15 s | 45 s |

---

## Appendix A: World Coordinate System

```
(0,0)─────────────────────────────────► X (WORLD_WIDTH)
  │
  │    River flows left to right
  │
  │    ┌─────────────────────────┐
  │    │  Shallow zone (top)     │   ← smaller trouts tend to spawn here
  │    │                         │
  │    │  Deep zone (center)     │   ← larger trouts roam here
  │    │                         │
  │    │  Riverbed zone (bottom) │   ← decoration layer
  │    └─────────────────────────┘
  │
  ▼
  Y (WORLD_HEIGHT)
```

Trout Y-position bias by tier (subtle, not strict):
- Tiers 1-2: Y within 10%-50% of world height
- Tiers 3-4: Y within 20%-70%
- Tiers 5-6: Y within 30%-80%

## Appendix B: Vercel Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync-holders",
      "schedule": "*/10 * * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/trouts",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=60, stale-while-revalidate=300" }
      ]
    },
    {
      "source": "/api/stats",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=120, stale-while-revalidate=600" }
      ]
    }
  ]
}
```

## Appendix C: Placeholder Sprite Generation

For MVP, generate simple placeholder sprites programmatically:

```typescript
// scripts/generate-placeholders.ts
// Creates colored rectangle sprites for each tier as placeholder art
// Run once: npx tsx scripts/generate-placeholders.ts
// Output: public/assets/sprites/trout-atlas.png + trout-atlas.json
```

This allows development to proceed without waiting for art assets. The sprite sheet is hot-swappable — drop in final art and rebuild.

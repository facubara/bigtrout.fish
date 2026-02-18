/**
 * Web Worker for trout simulation.
 *
 * Runs all 12k+ trout position updates off the main thread.
 * Communicates via typed postMessage protocol.
 *
 * NOTE: This worker cannot use @/ path aliases or import from files
 * that depend on browser/Node APIs. All logic is self-contained or
 * uses inlined copies of pure functions.
 */

// ─── Types (inlined to avoid import issues in worker) ────────

type TroutTier = 1 | 2 | 3 | 4 | 5 | 6;

interface AABB {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface TroutInput {
  address: string;
  x: number;
  y: number;
  tier: TroutTier;
  scale: number;
}

interface SimState {
  address: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  direction: 1 | -1;
  tier: TroutTier;
  scale: number;
  nextWaypointTime: number;
  animTimer: number;
}

// ─── Constants ───────────────────────────────────────────────

const TIER_SPEEDS: Record<TroutTier, { min: number; max: number }> = {
  1: { min: 60, max: 100 },
  2: { min: 45, max: 75 },
  3: { min: 30, max: 55 },
  4: { min: 20, max: 40 },
  5: { min: 12, max: 25 },
  6: { min: 8, max: 15 },
};

const TIER_WANDER: Record<TroutTier, number> = {
  1: 150, 2: 250, 3: 400, 4: 600, 5: 800, 6: 1200,
};

const TIER_FRAMES: Record<TroutTier, number> = {
  1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6,
};

const TIER_Y_BIAS: Record<TroutTier, { min: number; max: number }> = {
  1: { min: 0.1, max: 0.5 },
  2: { min: 0.1, max: 0.5 },
  3: { min: 0.2, max: 0.7 },
  4: { min: 0.2, max: 0.7 },
  5: { min: 0.3, max: 0.8 },
  6: { min: 0.3, max: 0.8 },
};

const CELL_SIZE = 200;
const FLOATS_PER_TROUT = 6; // x, y, direction, tier, scale, animFrame

// ─── State ───────────────────────────────────────────────────

let worldWidth = 20000;
let worldHeight = 12000;
let gridCols = Math.ceil(worldWidth / CELL_SIZE);

const trouts = new Map<string, SimState>();
const cells = new Map<number, Set<string>>();
const entityCells = new Map<string, number>();
let viewport: AABB = { x1: 0, y1: 0, x2: 4000, y2: 2400 };
let lastVisibleAddresses: string[] = [];

// ─── Spatial Grid ────────────────────────────────────────────

function cellIndex(x: number, y: number): number {
  const col = Math.floor(Math.max(0, x) / CELL_SIZE);
  const row = Math.floor(Math.max(0, y) / CELL_SIZE);
  return row * gridCols + col;
}

function gridInsert(address: string, x: number, y: number): void {
  const idx = cellIndex(x, y);
  const oldIdx = entityCells.get(address);

  if (oldIdx === idx) return;

  if (oldIdx !== undefined) {
    const cell = cells.get(oldIdx);
    if (cell) {
      cell.delete(address);
      if (cell.size === 0) cells.delete(oldIdx);
    }
  }

  let cell = cells.get(idx);
  if (!cell) {
    cell = new Set();
    cells.set(idx, cell);
  }
  cell.add(address);
  entityCells.set(address, idx);
}

function gridQuery(bounds: AABB): string[] {
  const result: string[] = [];
  const minCol = Math.max(0, Math.floor(bounds.x1 / CELL_SIZE));
  const maxCol = Math.floor(bounds.x2 / CELL_SIZE);
  const minRow = Math.max(0, Math.floor(bounds.y1 / CELL_SIZE));
  const maxRow = Math.floor(bounds.y2 / CELL_SIZE);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell = cells.get(row * gridCols + col);
      if (cell) {
        for (const addr of cell) {
          result.push(addr);
        }
      }
    }
  }
  return result;
}

// ─── Pure helpers ────────────────────────────────────────────

function seedHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 0xffffffff;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ─── Simulation ──────────────────────────────────────────────

function initState(input: TroutInput): SimState {
  const seed = seedHash(input.address);
  const sp = TIER_SPEEDS[input.tier];
  const speed = sp.min + seed * (sp.max - sp.min);
  const yBias = TIER_Y_BIAS[input.tier];
  const biasedY = worldHeight * (yBias.min + seed * (yBias.max - yBias.min));

  const state: SimState = {
    address: input.address,
    x: input.x || seed * worldWidth,
    y: input.y || biasedY,
    targetX: 0,
    targetY: 0,
    speed,
    direction: seed > 0.5 ? 1 : -1,
    tier: input.tier,
    scale: input.scale,
    nextWaypointTime: 0,
    animTimer: seed * 1000,
  };

  pickWaypoint(state);
  return state;
}

function pickWaypoint(s: SimState): void {
  const radius = TIER_WANDER[s.tier];
  const angle = Math.random() * Math.PI * 2;
  const dist = radius * (0.5 + Math.random() * 0.5);

  const yBias = TIER_Y_BIAS[s.tier];
  const yCenter = worldHeight * ((yBias.min + yBias.max) / 2);
  const yPull = (yCenter - s.y) * 0.1;

  s.targetX = clamp(s.x + Math.cos(angle) * dist, 50, worldWidth - 50);
  s.targetY = clamp(s.y + Math.sin(angle) * dist + yPull, 50, worldHeight - 50);
  s.direction = s.targetX > s.x ? 1 : -1;

  const travelTime = dist / s.speed;
  s.nextWaypointTime = Date.now() + travelTime * 1000 + Math.random() * 2000;
}

function tick(deltaMs: number): void {
  const dt = deltaMs / 1000;
  const now = Date.now();

  for (const s of trouts.values()) {
    const dx = s.targetX - s.x;
    const dy = s.targetY - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2 || now > s.nextWaypointTime) {
      pickWaypoint(s);
    } else {
      const step = s.speed * dt;
      const ratio = step < dist ? step / dist : 1;
      s.x += dx * ratio;
      s.y += dy * ratio;
      if (Math.abs(dx) > 0.5) {
        s.direction = dx > 0 ? 1 : -1;
      }
    }

    // Animation timer — wrap to prevent float precision loss after long sessions
    s.animTimer = (s.animTimer + deltaMs) % 100000;

    // Update spatial grid
    gridInsert(s.address, s.x, s.y);
  }
}

function getVisibleTrouts(): { addresses: string[]; buffer: Float32Array; count: number } {
  const rawAddrs = gridQuery(viewport);

  // Filter out addresses that aren't in the trouts map (race condition during removal)
  const validAddrs: string[] = [];
  const validStates: SimState[] = [];
  for (let i = 0; i < rawAddrs.length; i++) {
    const s = trouts.get(rawAddrs[i]);
    if (s) {
      validAddrs.push(rawAddrs[i]);
      validStates.push(s);
    }
  }

  const buffer = new Float32Array(validAddrs.length * FLOATS_PER_TROUT);

  for (let i = 0; i < validStates.length; i++) {
    const s = validStates[i];
    const off = i * FLOATS_PER_TROUT;
    const frames = TIER_FRAMES[s.tier];
    const animFrame = Math.floor(s.animTimer / 200) % frames;

    buffer[off] = s.x;
    buffer[off + 1] = s.y;
    buffer[off + 2] = s.direction;
    buffer[off + 3] = s.tier;
    buffer[off + 4] = s.scale;
    buffer[off + 5] = animFrame;
  }

  return { addresses: validAddrs, buffer, count: validAddrs.length };
}

// ─── Message Handler ─────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT": {
      worldWidth = msg.payload.worldWidth;
      worldHeight = msg.payload.worldHeight;
      gridCols = Math.ceil(worldWidth / CELL_SIZE);
      break;
    }

    case "LOAD_TROUTS": {
      for (const t of msg.payload) {
        if (!trouts.has(t.address)) {
          const state = initState(t);
          trouts.set(t.address, state);
          gridInsert(t.address, state.x, state.y);
        }
      }
      self.postMessage({
        type: "STATS",
        payload: { totalCount: trouts.size, visibleCount: lastVisibleAddresses.length },
      });
      break;
    }

    case "UPDATE_TROUT": {
      const t = msg.payload;
      const existing = trouts.get(t.address);
      if (existing) {
        existing.tier = t.tier;
        existing.scale = t.scale;
      } else {
        const state = initState(t);
        trouts.set(t.address, state);
        gridInsert(t.address, state.x, state.y);
      }
      break;
    }

    case "REMOVE_TROUT": {
      const addr = msg.payload.address;
      trouts.delete(addr);
      const cellIdx = entityCells.get(addr);
      if (cellIdx !== undefined) {
        const cell = cells.get(cellIdx);
        if (cell) {
          cell.delete(addr);
          if (cell.size === 0) cells.delete(cellIdx);
        }
        entityCells.delete(addr);
      }
      break;
    }

    case "SET_VIEWPORT": {
      viewport = msg.payload;
      break;
    }

    case "TICK": {
      tick(msg.payload.deltaMs);
      const { addresses, buffer } = getVisibleTrouts();
      lastVisibleAddresses = addresses;

      self.postMessage(
        {
          type: "VISIBLE_TROUTS",
          addresses,
          buffer,
          count: addresses.length,
        },
        { transfer: [buffer.buffer] }
      );
      break;
    }
  }
};

import type { TroutTier, TroutSimState, AABB } from "@/types";
import { seedFromAddress } from "./sizing";

// ─── Speed by tier (px/s) ────────────────────────────────────

const TIER_SPEEDS: Record<TroutTier, { min: number; max: number }> = {
  1: { min: 60, max: 100 }, // Fry: fast and darty
  2: { min: 45, max: 75 },
  3: { min: 30, max: 55 },
  4: { min: 20, max: 40 },
  5: { min: 12, max: 25 },
  6: { min: 8, max: 15 }, // Leviathan: slow and majestic
};

const TIER_WANDER_RADIUS: Record<TroutTier, number> = {
  1: 150,
  2: 250,
  3: 400,
  4: 600,
  5: 800,
  6: 1200,
};

// Y-position bias: smaller fish swim higher, bigger fish deeper
const TIER_Y_BIAS: Record<TroutTier, { min: number; max: number }> = {
  1: { min: 0.1, max: 0.5 },
  2: { min: 0.1, max: 0.5 },
  3: { min: 0.2, max: 0.7 },
  4: { min: 0.2, max: 0.7 },
  5: { min: 0.3, max: 0.8 },
  6: { min: 0.3, max: 0.8 },
};

// ─── Initialize trout state ─────────────────────────────────

export function initTroutState(
  address: string,
  x: number,
  y: number,
  tier: TroutTier,
  scale: number,
  worldBounds: AABB
): TroutSimState {
  const seed = seedFromAddress(address);
  const speedRange = TIER_SPEEDS[tier];
  const speed = speedRange.min + seed * (speedRange.max - speedRange.min);

  // Apply Y bias based on tier
  const yBias = TIER_Y_BIAS[tier];
  const worldHeight = worldBounds.y2 - worldBounds.y1;
  const biasedY = worldBounds.y1 + worldHeight * (yBias.min + seed * (yBias.max - yBias.min));
  const clampedY = clamp(y || biasedY, worldBounds.y1, worldBounds.y2);

  const state: TroutSimState = {
    address,
    x: x || seed * (worldBounds.x2 - worldBounds.x1),
    y: clampedY,
    targetX: 0,
    targetY: 0,
    speed,
    direction: seed > 0.5 ? 1 : -1,
    tier,
    scale,
    nextWaypointTime: 0,
  };

  pickNextWaypoint(state, worldBounds);
  return state;
}

// ─── Waypoint selection ──────────────────────────────────────

export function pickNextWaypoint(
  state: TroutSimState,
  worldBounds: AABB
): void {
  const wanderRadius = TIER_WANDER_RADIUS[state.tier];
  const angle = Math.random() * Math.PI * 2;
  const dist = wanderRadius * (0.5 + Math.random() * 0.5);

  // Apply Y bias to keep fish in their preferred zone
  const yBias = TIER_Y_BIAS[state.tier];
  const worldHeight = worldBounds.y2 - worldBounds.y1;
  const yCenter =
    worldBounds.y1 + worldHeight * ((yBias.min + yBias.max) / 2);
  const yOffset = (yCenter - state.y) * 0.1; // gentle pull toward preferred zone

  state.targetX = clamp(
    state.x + Math.cos(angle) * dist,
    worldBounds.x1 + 50,
    worldBounds.x2 - 50
  );
  state.targetY = clamp(
    state.y + Math.sin(angle) * dist + yOffset,
    worldBounds.y1 + 50,
    worldBounds.y2 - 50
  );

  // Face direction of travel
  state.direction = state.targetX > state.x ? 1 : -1;

  // Time until next waypoint
  const travelTime = dist / state.speed;
  state.nextWaypointTime =
    Date.now() + travelTime * 1000 + Math.random() * 2000;
}

// ─── Per-tick position update ────────────────────────────────

export function updatePosition(
  state: TroutSimState,
  deltaSeconds: number,
  worldBounds: AABB
): void {
  const dx = state.targetX - state.x;
  const dy = state.targetY - state.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 2 || Date.now() > state.nextWaypointTime) {
    pickNextWaypoint(state, worldBounds);
    return;
  }

  const step = state.speed * deltaSeconds;
  const ratio = Math.min(step / dist, 1);
  state.x += dx * ratio;
  state.y += dy * ratio;

  // Update facing direction
  if (Math.abs(dx) > 0.5) {
    state.direction = dx > 0 ? 1 : -1;
  }
}

// ─── Utility ─────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Trout Core Types ────────────────────────────────────────

export type TroutTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface TroutData {
  address: string;
  displayName: string | null;
  balance: number;
  firstSeen: string; // ISO 8601
  daysHeld: number;
  score: number;
  tier: TroutTier;
  rank: number;
  x: number;
  y: number;
}

export interface TroutSimState {
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
}

export interface VisibleTrout {
  address: string;
  x: number;
  y: number;
  direction: 1 | -1;
  tier: TroutTier;
  scale: number;
  animFrame: number;
}

// ─── Spatial / Camera ────────────────────────────────────────

export interface AABB {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}

// ─── Sizing ──────────────────────────────────────────────────

export interface TierThresholds {
  p20: number;
  p50: number;
  p80: number;
  p95: number;
  p99: number;
}

// ─── Device ──────────────────────────────────────────────────

export type QualityLevel = "low" | "medium" | "high";

export interface DeviceCapabilities {
  cores: number;
  memory: number | undefined;
  isMobile: boolean;
  isTouchDevice: boolean;
  pixelRatio: number;
  screenWidth: number;
}

// ─── Web Worker Messages ─────────────────────────────────────

export type MainToWorkerMessage =
  | { type: "INIT"; payload: { worldWidth: number; worldHeight: number } }
  | { type: "LOAD_TROUTS"; payload: TroutData[] }
  | { type: "UPDATE_TROUT"; payload: TroutData }
  | { type: "REMOVE_TROUT"; payload: { address: string } }
  | { type: "SET_VIEWPORT"; payload: AABB }
  | { type: "TICK"; payload: { deltaMs: number } };

export type WorkerToMainMessage =
  | {
      type: "VISIBLE_TROUTS";
      addresses: string[];
      buffer: Float32Array;
      count: number;
    }
  | { type: "STATS"; payload: { totalCount: number; visibleCount: number } };

// ─── API Types ───────────────────────────────────────────────

// GET /api/trouts
export interface TroutsResponse {
  trouts: TroutData[];
  nextCursor: string | null;
  total: number;
}

// GET /api/trouts/[address]
export type TroutDetailResponse = TroutData;

// GET /api/leaderboard
export interface LeaderboardEntry {
  rank: number;
  address: string;
  displayName: string | null;
  balance: number;
  daysHeld: number;
  score: number;
  tier: TroutTier;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  page: number;
  totalPages: number;
  totalEntries: number;
}

// POST /api/verify
export interface VerifyRequest {
  address: string;
  message: string;
  signature: string;
}

export interface VerifyResponse {
  verified: true;
  token: string;
  trout: {
    address: string;
    displayName: string | null;
    tier: TroutTier;
    rank: number;
  };
}

// POST /api/name
export interface NameRequest {
  displayName: string;
}

export interface NameResponse {
  displayName: string;
  address: string;
}

// GET /api/stats
export interface StatsResponse {
  totalHolders: number;
  totalSupplyHeld: number;
  avgDaysHeld: number;
  largestTrout: {
    address: string;
    displayName: string | null;
    score: number;
  };
  oldestTrout: {
    address: string;
    displayName: string | null;
    daysHeld: number;
  };
  lastUpdated: string;
}

// Common error
export interface ApiError {
  error: string;
}

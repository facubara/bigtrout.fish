import type { TroutTier, TierThresholds } from "@/types";

// ─── Score Calculation ───────────────────────────────────────

export function computeTroutScore(
  tokensHeld: number,
  daysHeld: number
): number {
  return Math.sqrt(Math.max(tokensHeld, 0)) * Math.sqrt(Math.max(daysHeld, 1));
}

// ─── Percentile Thresholds ───────────────────────────────────

export function computeThresholds(
  sortedScoresDesc: number[]
): TierThresholds {
  const n = sortedScoresDesc.length;
  if (n === 0) {
    return { p20: 0, p50: 0, p80: 0, p95: 0, p99: 0 };
  }
  return {
    p20: sortedScoresDesc[Math.floor(n * 0.8)] ?? 0,
    p50: sortedScoresDesc[Math.floor(n * 0.5)] ?? 0,
    p80: sortedScoresDesc[Math.floor(n * 0.2)] ?? 0,
    p95: sortedScoresDesc[Math.floor(n * 0.05)] ?? 0,
    p99: sortedScoresDesc[Math.floor(n * 0.01)] ?? 0,
  };
}

// ─── Tier Assignment ─────────────────────────────────────────

export function assignTier(
  score: number,
  thresholds: TierThresholds
): TroutTier {
  if (score >= thresholds.p99) return 6; // Leviathan — top 1%
  if (score >= thresholds.p95) return 5; // Trophy    — top 5%
  if (score >= thresholds.p80) return 4; // Adult     — top 20%
  if (score >= thresholds.p50) return 3; // Juvenile  — top 50%
  if (score >= thresholds.p20) return 2; // Fingerling— top 80%
  return 1; // Fry — bottom 20%
}

// ─── Visual Scale ────────────────────────────────────────────

const TIER_BASE_SCALES: Record<TroutTier, number> = {
  1: 0.5,
  2: 0.8,
  3: 1.0,
  4: 1.3,
  5: 1.6,
  6: 2.0,
};

export function computeVisualScale(
  score: number,
  tier: TroutTier,
  thresholds: TierThresholds
): number {
  const tierMin = getTierMin(tier, thresholds);
  const tierMax = getTierMax(tier, thresholds);
  const range = tierMax - tierMin;
  const t = range > 0 ? Math.min((score - tierMin) / range, 1) : 0.5;
  return TIER_BASE_SCALES[tier] + t * 0.3;
}

function getTierMin(tier: TroutTier, t: TierThresholds): number {
  switch (tier) {
    case 1: return 0;
    case 2: return t.p20;
    case 3: return t.p50;
    case 4: return t.p80;
    case 5: return t.p95;
    case 6: return t.p99;
  }
}

function getTierMax(tier: TroutTier, t: TierThresholds): number {
  switch (tier) {
    case 1: return t.p20;
    case 2: return t.p50;
    case 3: return t.p80;
    case 4: return t.p95;
    case 5: return t.p99;
    case 6: return Infinity;
  }
}

// ─── World Size Scaling ──────────────────────────────────────

export function computeWorldSize(holderCount: number): {
  width: number;
  height: number;
} {
  const area = holderCount * 1600;
  const aspect = 5 / 3;
  const height = Math.sqrt(area / aspect);
  const width = height * aspect;
  return {
    width: Math.max(Math.round(width), 4000),
    height: Math.max(Math.round(height), 2400),
  };
}

// ─── Deterministic Seeding ───────────────────────────────────

export function seedFromAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash + address.charCodeAt(i)) | 0;
  }
  return (hash >>> 0) / 0xffffffff;
}

export function computeStablePosition(
  address: string,
  worldWidth: number,
  worldHeight: number
): { x: number; y: number } {
  const seed1 = seedFromAddress(address);
  const seed2 = seedFromAddress(address + "y");
  return {
    x: seed1 * worldWidth,
    y: seed2 * worldHeight,
  };
}

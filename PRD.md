# Big Trout Fish - Product Requirements Document

## 1. Overview

**Project:** Big Trout Fish
**Domain:** bigtrout.fish
**Description:** A real-time visualization website for the Big Trout memecoin on Solana. Token holders are represented as pixel-art trouts swimming in a freshwater river scene. Trout size is determined by tokens held and holding duration. Users can verify their wallet via Phantom to claim and rename their trout.

**Target:** ~12,400 holders at launch, must scale beyond.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Rendering | PixiJS (2D Canvas/WebGL sprites) |
| Language | TypeScript |
| Database | PostgreSQL (Neon/Supabase) for persistent data |
| Cache | Redis (Upstash) for hot trout data + positions |
| Data Source | Hybrid — third-party Solana indexer (Helius/Birdeye) for bulk holder snapshots + on-chain RPC for individual wallet verification |
| Auth | Phantom wallet signature verification (no traditional auth) |
| Deployment | Vercel |
| Styling | Tailwind CSS (for UI overlays) |

---

## 3. Core Features

### 3.1 Trout Visualization (MVP)

**The Ocean Scene**
- Fullscreen canvas rendering a freshwater river environment
- Pixel-art background with rocks, aquatic plants, and a lighter natural color palette
- Subtle parallax layers for depth (foreground plants, midground fish, background rocks)
- Each token holder = one trout sprite swimming in the scene

**Trout Rendering**
- Pixel-art trout sprites in multiple size tiers (e.g., 5-6 sprite variants from tiny to whale)
- Sprites must be easily swappable — asset pipeline should support hot-swapping sprite sheets
- Sprite variant selected based on computed trout size (see formula below)
- Each trout has a small label underneath: custom name or truncated Solana address (`Ab3x...9fZ2`)

**Trout Size Formula**
```
troutSize = sqrt(tokensHeld) × sqrt(daysHeld)
```
- `tokensHeld`: current token balance of the wallet
- `daysHeld`: number of days since the wallet first acquired the token
- The result maps to discrete sprite tiers and a scale multiplier within each tier
- Visual size is clamped to a min/max to prevent invisible fish or screen-filling whales

**Trout Swimming Behavior**
- Size-based movement: large trouts swim slower and more deliberately, small trouts dart around quickly
- Each trout has randomized but smooth movement using interpolated waypoints
- Trouts stay within the virtual river bounds
- No complex flocking — keep it performant at 12k+ entities

**Viewport & Navigation**
- Virtual ocean larger than the screen — viewport culling (only render trouts visible in viewport)
- User can **pan** (click-drag / touch-drag) and **zoom** (scroll wheel / pinch) to explore
- Spatial hashing or quadtree for efficient viewport queries
- Minimap (optional, post-MVP) showing density of trouts across the river

### 3.2 Trout Interaction

**Hover/Click on a Trout**
- Tooltip appears showing:
  - Name (custom or truncated address)
  - Full Solana address (copyable)
  - Tokens held
  - Days held
  - Trout size rank (e.g., #342 of 12,400)
- Option to "Follow this trout" — camera smoothly follows the selected trout as it swims
- Click elsewhere or press Escape to stop following

**Search Bar (Overlay)**
- Floating search bar to find a trout by Solana address or custom name
- On match: camera pans to the trout and highlights it
- Autocomplete for custom names

### 3.3 Wallet Verification & Naming

**Phantom Wallet Connection**
- "Find My Trout" button in the UI overlay
- Connect via Phantom wallet adapter (@solana/wallet-adapter)
- User signs a message to prove ownership (no transaction required)
- Backend verifies signature matches a known holder address

**Custom Naming**
- After verification, user can set a custom display name for their trout
- **Constraints:**
  - Max 20 characters
  - Alphanumeric + basic symbols (a-z, 0-9, `_`, `-`, `.`)
  - Profanity filter (server-side, use a library like `bad-words` or similar)
  - Names must be unique (first-come, first-served)
- Name is stored in PostgreSQL, linked to the wallet address
- Name updates immediately in the visualization

### 3.4 Leaderboard

- Separate page (`/leaderboard`) or slide-out panel
- Rankings by trout size (descending)
- Columns: Rank, Name/Address, Tokens Held, Days Held, Trout Size
- Search/filter by address or name
- Click a row to jump to that trout in the visualization
- Paginated (50 per page) with total count

### 3.5 Share / Screenshot

- "Screenshot" button appears when following a trout or via the overlay
- Captures the current canvas viewport as a PNG
- Adds a branded watermark/frame (Big Trout Fish logo + URL)
- Share options: download image, copy to clipboard, share to X/Twitter with pre-filled text
- Share URL format: `bigtrout.fish/?trout=<address>` — deep link that focuses on a specific trout

---

## 4. Data Architecture

### 4.1 Data Flow

```
Solana Blockchain
       |
       v
[Helius/Birdeye API] ---(cron every 10 min)---> [Backend API Route]
       |                                              |
       v                                              v
  Bulk holder data                              [PostgreSQL]
  (address, balance)                            - holders table
       |                                        - custom_names table
       v                                              |
   [Redis Cache]                                      |
   - holder balances                                  |
   - computed trout sizes                             |
   - position/state cache                             |
       |                                              |
       v                                              v
   [Next.js API] <-------- read --------- [Frontend PixiJS]
       |
       v
  On-chain RPC (for individual wallet verification only)
```

### 4.2 Database Schema

**holders**
| Column | Type | Description |
|--------|------|-------------|
| address | VARCHAR(44) PK | Solana wallet address |
| balance | BIGINT | Token balance (raw units) |
| first_seen | TIMESTAMP | First time this wallet held the token |
| last_updated | TIMESTAMP | Last data refresh |

**custom_names**
| Column | Type | Description |
|--------|------|-------------|
| address | VARCHAR(44) PK FK | Wallet address |
| display_name | VARCHAR(20) UNIQUE | Custom display name |
| verified_at | TIMESTAMP | When wallet was verified |
| updated_at | TIMESTAMP | Last name change |

### 4.3 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trouts` | Paginated list of trouts with computed sizes. Supports `?bbox=` for viewport queries |
| GET | `/api/trouts/[address]` | Single trout details |
| GET | `/api/leaderboard` | Ranked list, supports `?page=&limit=&search=` |
| POST | `/api/verify` | Submit signed message for wallet verification |
| POST | `/api/name` | Set/update custom name (requires prior verification) |
| GET | `/api/stats` | Global stats (total holders, total supply held, etc.) |

### 4.4 Redis Cache Strategy

- **`trout:all`** — Sorted set of all addresses by trout size (for leaderboard)
- **`trout:data:<address>`** — Hash with balance, first_seen, computed_size
- **`trout:grid:<x>:<y>`** — Set of addresses in each spatial grid cell (for viewport queries)
- TTL: 10 minutes (matches cron refresh interval)
- Position data is computed server-side and cached — client receives pre-computed positions

---

## 5. Performance Strategy

### 5.1 Rendering Performance (Client)

- **Viewport culling:** Only create PixiJS sprites for trouts inside the visible area + buffer zone
- **Object pooling:** Reuse sprite objects as trouts enter/exit viewport instead of create/destroy
- **Sprite sheets:** All trout variants in a single texture atlas to minimize draw calls
- **Batched rendering:** PixiJS ParticleContainer for small trouts (limited features, max perf)
- **LOD (Level of Detail):** At far zoom, small trouts render as simple colored dots; at close zoom, full sprites with labels
- **RequestAnimationFrame throttling:** Cap at 60fps, reduce to 30fps when tab is not focused
- **Web Workers:** Offload position calculations and spatial hashing to a Web Worker

### 5.2 Data Performance (Server)

- **Redis-first reads:** All visualization data served from Redis, never hit PostgreSQL on client requests
- **Incremental updates:** Cron job only updates changed balances, not full re-fetch
- **CDN caching:** Vercel Edge caching on `/api/trouts` with 60s stale-while-revalidate
- **Pagination:** Never send all 12k+ trouts at once; viewport-based chunking
- **Compression:** gzip/brotli on API responses

### 5.3 Scalability Targets

| Metric | Target |
|--------|--------|
| Holders supported | 50,000+ |
| Concurrent users | 1,000+ |
| Canvas FPS (desktop) | 60fps with 500 visible trouts |
| Canvas FPS (mobile) | 30fps with 100 visible trouts |
| API response time | < 100ms (cached) |
| Data freshness | < 10 minutes |

---

## 6. Mobile Experience

- **Simplified rendering:** Reduce visible trout count, lower LOD thresholds, disable labels at default zoom
- **Touch controls:** Pinch-to-zoom, drag-to-pan
- **Responsive overlay UI:** Search bar, leaderboard, and wallet connection adapt to mobile screen sizes
- **Performance detection:** Check `navigator.hardwareConcurrency` and `deviceMemory` to auto-adjust quality
- **Desktop prompt:** Subtle banner suggesting desktop for the full experience

---

## 7. UI Overlay Layout

```
+---------------------------------------------------+
|  [Big Trout Logo]          [Search] [Leaderboard]  |
|                            [Find My Trout]          |
|                                                     |
|                                                     |
|            << Fullscreen PixiJS Canvas >>            |
|                                                     |
|                                                     |
|                                                     |
|  [Zoom +/-]                       [Screenshot]      |
|  [Stats: 12,400 trouts swimming]                    |
+---------------------------------------------------+
```

- All UI elements are HTML overlays on top of the canvas (not rendered inside PixiJS)
- Semi-transparent backgrounds, minimal footprint
- Collapsible on mobile

---

## 8. MVP Scope (Phase 1 — 1-2 Weeks)

### Must Have
- [ ] Fullscreen PixiJS river scene with placeholder pixel-art sprites
- [ ] Fetch and display all holders as trouts with size-based scaling
- [ ] Viewport panning and zooming with culling
- [ ] Size-based swimming behavior
- [ ] Hover tooltip with holder info
- [ ] Search bar to find a trout by address
- [ ] Phantom wallet connection + signature verification
- [ ] Custom naming with character limit + profanity filter
- [ ] Basic API routes with Redis caching
- [ ] Cron job for holder data refresh
- [ ] Deploy to Vercel

### Nice to Have (Phase 1)
- [ ] Follow camera on selected trout
- [ ] Leaderboard page
- [ ] Screenshot/share feature

### Phase 2 (Post-MVP)
- [ ] Polished pixel art sprites (artist/AI-generated)
- [ ] Background detail (animated water, bubbles, plants)
- [ ] Sound effects / ambient audio
- [ ] Minimap
- [ ] Deep link sharing (`bigtrout.fish/?trout=<address>`)
- [ ] SNS (.sol domain) resolution for display names
- [ ] Analytics dashboard (total holders over time, etc.)

---

## 9. Project Structure

```
bigtrout.fish/
├── public/
│   └── assets/
│       ├── sprites/          # Trout sprite sheets (easily swappable)
│       ├── background/       # River background tiles
│       └── ui/               # Logo, icons
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main visualization page
│   │   ├── leaderboard/
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   ├── trouts/
│   │   │   ├── verify/
│   │   │   ├── name/
│   │   │   ├── leaderboard/
│   │   │   └── stats/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── TroutScene.tsx       # Main PixiJS scene manager
│   │   │   ├── TroutSprite.ts       # Individual trout entity
│   │   │   ├── SpatialGrid.ts       # Spatial hashing for culling
│   │   │   ├── ObjectPool.ts        # Sprite object pool
│   │   │   └── Camera.ts            # Pan/zoom camera controller
│   │   ├── overlay/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── TroutTooltip.tsx
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── StatsBar.tsx
│   │   │   └── ScreenshotButton.tsx
│   │   └── leaderboard/
│   │       └── LeaderboardTable.tsx
│   ├── lib/
│   │   ├── solana/
│   │   │   ├── client.ts            # Solana RPC client
│   │   │   ├── verify.ts            # Signature verification
│   │   │   └── holders.ts           # Holder data fetching
│   │   ├── db/
│   │   │   ├── postgres.ts          # PostgreSQL client
│   │   │   ├── redis.ts             # Redis client
│   │   │   └── schema.ts            # Drizzle/Prisma schema
│   │   ├── trout/
│   │   │   ├── sizing.ts            # Size formula: sqrt(tokens) × sqrt(days)
│   │   │   ├── movement.ts          # Movement/behavior logic
│   │   │   └── naming.ts            # Name validation + profanity filter
│   │   └── utils/
│   │       └── ...
│   ├── hooks/
│   │   ├── useWallet.ts
│   │   ├── useTroutData.ts
│   │   └── useViewport.ts
│   ├── workers/
│   │   └── trout-simulation.worker.ts  # Web Worker for position updates
│   └── types/
│       └── index.ts
├── scripts/
│   └── sync-holders.ts       # Cron job script for data sync
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── PRD.md
```

---

## 10. Environment Variables

```
# Solana
SOLANA_RPC_URL=
TOKEN_MINT_ADDRESS=
HELIUS_API_KEY=

# Database
DATABASE_URL=              # PostgreSQL connection string
REDIS_URL=                 # Redis connection string

# App
NEXT_PUBLIC_APP_URL=https://bigtrout.fish
CRON_SECRET=               # Secret for cron job authentication
```

---

## 11. Open Questions

- [ ] Exact token contract/mint address (to be provided)
- [ ] Solana RPC provider selection (Helius, QuickNode, etc.)
- [ ] Budget for hosting (Vercel Pro, Redis, PostgreSQL tiers)
- [ ] How to handle wallets that sell all tokens — remove trout immediately or fade out?
- [ ] Should there be a minimum token threshold to appear as a trout?
- [ ] Rate of name changes — unlimited or cooldown period?

# Next Steps — Step 1: Asset Creation

Replace the current procedural PixiJS Graphics sprites with proper AI-generated pixel art assets.

---

## Recommended AI Pixel Art Tools

| Tool | Best For | Link |
|------|----------|------|
| **PixelLab** | Sprite sheets with animation frames, game-ready output | pixellab.ai |
| **PixelBox** | Quick individual pixel art sprites | pixelbox.dev |
| **a1.art** | High-quality pixel art generation with style control | a1.art |
| **MyAIArt Tileset Generator** | Seamless tiling textures for backgrounds | myaiart.com |
| **OpenArt** | General-purpose AI art with pixel art models | openart.ai |
| **Imagine.art** | Versatile image generation with pixel art styles | imagine.art |

---

## 1A. Trout Sprite Assets

### Overview

| Tier | Name | Grid (current) | Target Resolutions | Animation Frames | Frames Total |
|------|------|----------------|---------------------|------------------|--------------|
| 1 | Fry | 9×5 (SMALL) | 16×16, 32×32, 64×64 | 2 | 6 |
| 2 | Fingerling | 9×5 (SMALL) | 16×16, 32×32, 64×64 | 2 | 6 |
| 3 | Juvenile | 16×9 (MEDIUM) | 16×16, 32×32, 64×64 | 4 | 12 |
| 4 | Adult | 16×9 (MEDIUM) | 16×16, 32×32, 64×64 | 4 | 12 |
| 5 | Trophy | 22×11 (LARGE) | 16×16, 32×32, 64×64 | 6 | 18 |
| 6 | Leviathan | 22×11 (LARGE) | 16×16, 32×32, 64×64 | 6 | 18 |

**Total sprite frames: 72** (+ shadow and dot variants below)

### Color Palettes (from current codebase)

Each tier has a 9-color palette: outline, back, body, belly, stripe, eye, tail, fin, spot.

| Tier | Outline | Back | Body | Belly | Stripe | Tail/Fin | Spot |
|------|---------|------|------|-------|--------|----------|------|
| 1 Fry | `#4a6652` | `#6b8e73` | `#8aaa8e` | `#b5ccb8` | `#cc9e9e` | `#6b8e73` / `#7a9a80` | `#4a6a4e` |
| 2 Fingerling | `#3d5c3e` | `#5a7a5e` | `#7a9a70` | `#a8c09c` | `#d4938a` | `#6a8a5e` / `#7a9a6e` | `#3a5a36` |
| 3 Juvenile | `#2e4a30` | `#4a6a4a` | `#6a8a60` | `#a0b894` | `#d88878` | `#5a7a50` / `#6a8a5a` | `#2e4428` |
| 4 Adult | `#263e28` | `#3e5e3e` | `#5e7e54` | `#98b48c` | `#e07060` | `#4e6e44` / `#5e7e4e` | `#243820` |
| 5 Trophy | `#2a3e1e` | `#4a6636` | `#6a8a4e` | `#b0c890` | `#e8644e` | `#546e3a` / `#648a44` | `#1e3418` |
| 6 Leviathan | `#1e3018` | `#365830` | `#547a42` | `#a8c484` | `#f05840` | `#466834` / `#567e3c` | `#142810` |

**Design notes:**
- Tiers progress from pale silvery-green (Fry) to deep legendary greens (Leviathan)
- The stripe color intensifies from muted pink (`#cc9e9e`) to vivid red-orange (`#f05840`)
- All sprites are viewed **top-down** (bird's eye perspective)
- The trout faces **right** by default (flipped via `scale.x = -1` when swimming left)

### Animation Spec

- **Tiers 1–2 (2 frames):** Subtle tail wiggle — frame 1 is neutral, frame 2 has a slight tail offset
- **Tiers 3–4 (4 frames):** Full tail sweep cycle — neutral → tail up → neutral → tail down
- **Tiers 5–6 (6 frames):** Full body undulation — smooth sine-wave motion through the body with fin movement

### Shadow Sprites

One shadow per tier per resolution (18 total). Dark semi-transparent ellipses matching the trout's footprint.

- Color: `#0a2a1a` at 25% opacity
- Width: ~80% of trout sprite width
- Height: ~44% of trout sprite height

### Dot / LOD Fallback Sprites

Simple filled circles used when zoomed far out. One per tier (6 total).

| Tier | Color (body color) | Radius (px) |
|------|-------------------|-------------|
| 1 Fry | `#8aaa8e` | 1 |
| 2 Fingerling | `#7a9a70` | 2 |
| 3 Juvenile | `#6a8a60` | 3 |
| 4 Adult | `#5e7e54` | 3 |
| 5 Trophy | `#6a8a4e` | 4 |
| 6 Leviathan | `#547a42` | 5 |

### Prompts

#### Tier 1 — Fry (16×16)

```
Pixel art, 16x16 sprite sheet, top-down view of a tiny baby trout fry.
Pale silvery-green body (#8aaa8e), light belly (#b5ccb8), subtle pink lateral stripe (#cc9e9e).
Dark green outline (#4a6652). Small black eye dot. Forked tail in muted green (#6b8e73).
2 animation frames side by side: frame 1 neutral, frame 2 slight tail wiggle.
Transparent background. Clean pixel art, no anti-aliasing. Game-ready sprite sheet.
```

#### Tier 1 — Fry (32×32)

```
Pixel art, 32x32 sprite sheet, top-down view of a tiny baby trout fry.
Pale silvery-green body (#8aaa8e), light belly (#b5ccb8), subtle pink lateral stripe (#cc9e9e).
Dark green outline (#4a6652). Small black eye. Forked tail (#6b8e73), small pectoral fins (#7a9a80).
Dark spots (#4a6a4e) along the back. 2 animation frames side by side.
Transparent background. Clean pixel art, no anti-aliasing. Game-ready sprite sheet.
```

#### Tier 1 — Fry (64×64)

```
Pixel art, 64x64 sprite sheet, top-down view of a tiny baby trout fry.
Pale silvery-green body (#8aaa8e) with darker back (#6b8e73), light belly (#b5ccb8).
Subtle pink lateral stripe (#cc9e9e). Dark green outline (#4a6652).
Black eye (#1a1a1a). Detailed forked tail (#6b8e73), pectoral fins (#7a9a80).
Scattered dark spots (#4a6a4e). 2 animation frames side by side.
Transparent background. Clean pixel art, no anti-aliasing. Game-ready sprite sheet.
```

#### Tier 2 — Fingerling (16×16)

```
Pixel art, 16x16 sprite sheet, top-down view of a young trout fingerling.
Classic green body (#7a9a70), lighter belly (#a8c09c), salmon-pink stripe (#d4938a).
Dark outline (#3d5c3e). Black eye. Forked tail (#6a8a5e).
2 animation frames side by side: neutral and tail wiggle.
Transparent background. Clean pixel art, no anti-aliasing.
```

#### Tier 2 — Fingerling (32×32)

```
Pixel art, 32x32 sprite sheet, top-down view of a young trout fingerling.
Green body (#7a9a70), dark back (#5a7a5e), pale belly (#a8c09c).
Salmon-pink lateral stripe (#d4938a). Dark outline (#3d5c3e).
Black eye. Tail (#6a8a5e), fins (#7a9a6e), dark spots (#3a5a36).
2 animation frames. Transparent background. Clean pixel art.
```

#### Tier 2 — Fingerling (64×64)

```
Pixel art, 64x64 sprite sheet, top-down view of a young trout fingerling.
Detailed green body (#7a9a70), darker back (#5a7a5e), pale belly (#a8c09c).
Salmon-pink lateral stripe (#d4938a). Dark outline (#3d5c3e).
Black eye (#1a1a1a). Forked tail (#6a8a5e), pectoral fins (#7a9a6e).
Scattered dark spots (#3a5a36). 2 animation frames.
Transparent background. Clean pixel art, no anti-aliasing. Game-ready.
```

#### Tier 3 — Juvenile (16×16)

```
Pixel art, 16x16 sprite sheet, top-down view of a juvenile trout.
Rich green body (#6a8a60), dark back (#4a6a4a), soft belly (#a0b894).
Coral-red stripe (#d88878). Dark outline (#2e4a30). Black eye.
4 animation frames: tail sweep cycle (neutral, up, neutral, down).
Transparent background. Clean pixel art, no anti-aliasing.
```

#### Tier 3 — Juvenile (32×32)

```
Pixel art, 32x32 sprite sheet, top-down view of a juvenile trout.
Rich green body (#6a8a60), dark olive back (#4a6a4a), soft green belly (#a0b894).
Coral-red lateral stripe (#d88878). Dark outline (#2e4a30). Black eye (#111111).
Fins (#6a8a5a), forked tail (#5a7a50), dark spots (#2e4428).
4 animation frames in a row: tail sweep cycle.
Transparent background. Clean pixel art. Game-ready sprite sheet.
```

#### Tier 3 — Juvenile (64×64)

```
Pixel art, 64x64 sprite sheet, top-down view of a juvenile trout.
Rich green body (#6a8a60), dark olive back (#4a6a4a), soft belly (#a0b894).
Coral-red lateral stripe (#d88878). Dark outline (#2e4a30). Eye (#111111).
Detailed fins (#6a8a5a), forked tail (#5a7a50), scattered spots (#2e4428).
4 animation frames showing full tail sweep. More body detail at this resolution.
Transparent background. Clean pixel art, no anti-aliasing.
```

#### Tier 4 — Adult (16×16)

```
Pixel art, 16x16 sprite sheet, top-down view of an adult trout.
Vivid green body (#5e7e54), dark forest back (#3e5e3e), green belly (#98b48c).
Bold red-orange stripe (#e07060). Dark outline (#263e28). Black eye.
4 animation frames: tail sweep cycle.
Transparent background. Clean pixel art, no anti-aliasing.
```

#### Tier 4 — Adult (32×32)

```
Pixel art, 32x32 sprite sheet, top-down view of an adult trout.
Vivid green body (#5e7e54), dark forest back (#3e5e3e), lighter belly (#98b48c).
Bold red-orange lateral stripe (#e07060). Dark outline (#263e28). Eye (#0a0a0a).
Fins (#5e7e4e), tail (#4e6e44), dark spots (#243820).
4 animation frames. Transparent background. Clean pixel art. Game-ready.
```

#### Tier 4 — Adult (64×64)

```
Pixel art, 64x64 sprite sheet, top-down view of an adult trout.
Vivid green body (#5e7e54), dark forest back (#3e5e3e), lighter belly (#98b48c).
Bold red-orange lateral stripe (#e07060). Dark outline (#263e28). Eye (#0a0a0a).
Detailed fins (#5e7e4e), forked tail (#4e6e44), prominent spots (#243820).
4 animation frames showing full tail sweep cycle.
Transparent background. Clean pixel art, no anti-aliasing. Game-ready sprite sheet.
```

#### Tier 5 — Trophy (16×16)

```
Pixel art, 16x16 sprite sheet, top-down view of a large trophy trout.
Golden-green body (#6a8a4e), dark olive back (#4a6636), bright belly (#b0c890).
Intense orange-red stripe (#e8644e). Dark outline (#2a3e1e). Black eye.
6 animation frames: full body undulation with fin movement.
Transparent background. Clean pixel art, no anti-aliasing.
```

#### Tier 5 — Trophy (32×32)

```
Pixel art, 32x32 sprite sheet, top-down view of a large trophy trout.
Golden-green body (#6a8a4e), dark olive back (#4a6636), bright yellow-green belly (#b0c890).
Intense orange-red stripe (#e8644e). Dark outline (#2a3e1e). Eye (#080808).
Fins (#648a44), tail (#546e3a), dark spots (#1e3418).
6 animation frames: body undulation cycle.
Transparent background. Clean pixel art. Game-ready sprite sheet.
```

#### Tier 5 — Trophy (64×64)

```
Pixel art, 64x64 sprite sheet, top-down view of a large trophy trout.
Golden-green body (#6a8a4e), dark olive back (#4a6636), bright belly (#b0c890).
Intense orange-red stripe (#e8644e). Dark outline (#2a3e1e). Eye (#080808).
Detailed fins (#648a44), large forked tail (#546e3a), prominent spots (#1e3418).
6 animation frames showing full body undulation with sine-wave motion.
Transparent background. Clean pixel art, no anti-aliasing. Game-ready.
```

#### Tier 6 — Leviathan (16×16)

```
Pixel art, 16x16 sprite sheet, top-down view of a legendary massive leviathan trout.
Deep green body (#547a42), dark forest back (#365830), bright belly (#a8c484).
Fiery red stripe (#f05840). Very dark outline (#1e3018). Black eye.
Imposing, powerful silhouette. 6 animation frames: full body undulation.
Transparent background. Clean pixel art, no anti-aliasing.
```

#### Tier 6 — Leviathan (32×32)

```
Pixel art, 32x32 sprite sheet, top-down view of a legendary massive leviathan trout.
Deep green body (#547a42), dark forest back (#365830), bright green belly (#a8c484).
Fiery red stripe (#f05840). Very dark outline (#1e3018). Eye (#060606).
Large fins (#567e3c), powerful tail (#466834), dark spots (#142810).
Imposing presence. 6 animation frames: body undulation cycle.
Transparent background. Clean pixel art. Game-ready sprite sheet.
```

#### Tier 6 — Leviathan (64×64)

```
Pixel art, 64x64 sprite sheet, top-down view of a legendary massive leviathan trout.
Deep green body (#547a42), dark forest back (#365830), bright belly (#a8c484).
Fiery red stripe (#f05840). Very dark outline (#1e3018). Eye (#060606).
Highly detailed fins (#567e3c), powerful forked tail (#466834), prominent spots (#142810).
Imposing, legendary presence. Subtle glow or shimmer.
6 animation frames showing full body undulation with sine-wave motion and fin movement.
Transparent background. Clean pixel art, no anti-aliasing. Game-ready sprite sheet.
```

---

## 1B. Background Water Tiles

All tiles are **128×128 pixels**, seamless-tiling, matching the current teal palette (base `#2a5c5a`).

### Tile Variants Needed

| Variant | Description | Primary Colors |
|---------|-------------|---------------|
| **Deep Water** | Standard pond depth, subtle dark variation | Base `#2a5c5a`, darker patches `#1e4a48` |
| **Shallow Water** | Lighter areas near edges or sandbars | Base `#2a5c5a`, lighter patches `#3a6e6a` |
| **Caustics** | Light caustic patterns from surface refraction | Base `#2a5c5a`, highlights `#5a9a8a` at ~15–25% opacity |
| **Dark Depths** | Deep center areas of the pond | Base `#1e4a48`, subtle debris `#1a3a32` |

### Prompts

#### Deep Water Tile

```
Pixel art, 128x128 seamless tileable texture, top-down view of pond water.
Dark teal base (#2a5c5a) with subtle darker patches (#1e4a48) and slightly lighter areas (#3a6e6a).
Soft, organic blending. Tiny scattered debris dots (#1a3a32).
Must tile seamlessly in all directions. No visible seams.
Clean pixel art style. Transparent-free (fully opaque).
```

#### Shallow Water Tile

```
Pixel art, 128x128 seamless tileable texture, top-down view of shallow pond water.
Teal base (#2a5c5a) with prominent lighter patches (#3a6e6a) suggesting shallow depth.
Faint sandy undertones. Subtle pebble details.
Must tile seamlessly in all directions. No visible seams.
Clean pixel art style. Fully opaque.
```

#### Caustics Tile

```
Pixel art, 128x128 seamless tileable texture, top-down view of pond water with light caustics.
Dark teal base (#2a5c5a). Scattered bright caustic highlights (#5a9a8a) at low opacity.
Organic, wavy light refraction patterns on the water surface.
Must tile seamlessly in all directions. No visible seams.
Clean pixel art style. Fully opaque.
```

#### Dark Depths Tile

```
Pixel art, 128x128 seamless tileable texture, top-down view of deep dark pond water.
Very dark teal base (#1e4a48). Minimal variation, mostly uniform darkness.
Faint scattered debris (#1a3a32). Slightly ominous deep-water feel.
Must tile seamlessly in all directions. No visible seams.
Clean pixel art style. Fully opaque.
```

---

## Asset Summary

| Category | Count |
|----------|-------|
| Trout sprite frames (6 tiers × 3 res × variable frames) | **72** |
| Shadow sprites (6 tiers × 3 res) | **18** |
| Dot/LOD sprites (6 tiers × 1 each) | **6** |
| Water tiles (4 variants) | **4** |
| **Total assets** | **100** |

### Suggested File Organization

```
public/assets/
├── trout/
│   ├── tier1-fry/
│   │   ├── sprite-16x16.png     (2-frame sheet: 32×16)
│   │   ├── sprite-32x32.png     (2-frame sheet: 64×32)
│   │   ├── sprite-64x64.png     (2-frame sheet: 128×64)
│   │   ├── shadow-16x16.png
│   │   ├── shadow-32x32.png
│   │   ├── shadow-64x64.png
│   │   └── dot.png
│   ├── tier2-fingerling/
│   │   └── ...
│   ├── tier3-juvenile/
│   │   └── ...                  (4-frame sheets)
│   ├── tier4-adult/
│   │   └── ...                  (4-frame sheets)
│   ├── tier5-trophy/
│   │   └── ...                  (6-frame sheets)
│   └── tier6-leviathan/
│       └── ...                  (6-frame sheets)
└── water/
    ├── deep-water-128.png
    ├── shallow-water-128.png
    ├── caustics-128.png
    └── dark-depths-128.png
```

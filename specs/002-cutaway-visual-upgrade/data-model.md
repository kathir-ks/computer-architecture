# Data Model: Cutaway Visual Upgrade (v2)

No persistent data; all entities are in-memory scene/config structures. This document defines the new/changed structures and their invariants. (001's entities — chapters, steps, locations, highlight ids — are unchanged.)

## ViewingArc (new, `src/scene/World.ts`)

The allowed camera orbit range, applied to OrbitControls at construction.

| Field | Type | Value / Constraint |
|---|---|---|
| minAzimuth / maxAzimuth | radians | ≈ −80° / +80° measured from the +z (open-face) axis |
| minPolar / maxPolar | radians | ≈ 0.15π / 0.52π — no top-down, no under-ground |
| minDistance / maxDistance | world units | 4 / 90 (unchanged from v1) |

**Invariants**:
- Every `VANTAGES` entry (camera position relative to its target) must lie strictly inside the arc (unit-tested; guards against a scripted flyTo parking the camera somewhere the user's clamps then fight).
- The arc is fixed at startup; no runtime mutation.

## FollowTarget (new, `src/scene/index.ts`)

What the `follow` verb may track.

| Value | Resolves to | Disposal behavior |
|---|---|---|
| `'courier'` | courier van group | van never disposes; n/a |
| `'lift'` | lift car mesh | car never disposes; n/a |
| `PulseId` | pulse mesh | if disposed mid-follow, freeze aim at last-known position (FR-011) |

**State transitions** (camera-timeline slot `activeCameraTl`):

```
idle ──follow()──▶ following ──duration elapses──▶ idle (aim rests where it is)
following ──flyTo()──▶ flying        (follow killed, flyTo owns slot)
following ──user grab──▶ user-control (killed; nothing scripted until next verb)
following ──target disposed──▶ following-frozen (aim holds last position until duration ends)
```

**Invariant**: at most one scripted camera timeline exists at any moment (`flyTo` and `follow` share the `activeCameraTl` slot; acquiring it kills the previous owner).

## FloorPalette (new, `src/scene/Building.ts`)

Single source of the pastel color coding (extends the existing `COL` constant; latency numbers stay in `locations.ts`, pacing in `timing.ts`).

| Key | Floor(s) / element | Hue family |
|---|---|---|
| `desk` | floor 10 | warm cream |
| `l1` | floor 9 shelves | mint |
| `l2` | floor 8 storeroom | soft teal |
| `ram` | floor 4 archive | lavender-blue |
| `emptyFloor` | floors 2,3,5,6,7 | neutral warm grey |
| `warehouse` | disk warehouse | muted terracotta |
| `structure` | slabs, walls, ground, road | light neutrals |
| `sky` | background + fog | warm light blue |
| signals | hit / miss / focus | dark green / red / blue, distinct on pastel |

**Invariants**:
- Each functional group's hue is visibly distinct from adjacent groups (SC-003).
- Actor materials (worker, courier, lift car, pulses) are more saturated than any palette surface (FR-006).
- Signal colors remain pairwise distinguishable (FR-008).

## MoodSpec (changed, `src/scene/index.ts`)

| Field | Type | Change from v1 |
|---|---|---|
| bg / fog | color | daylight variants (golden intro, neutral working, dusk tense-miss, warm celebration) |
| hemi | color | NEW — hemisphere light tint tweened alongside bg/fog |

Same four mood keys, same `setMood` signature, same 1.2 s transition.

## EnvironmentSet (new, `src/scene/Environment.ts`)

| Component | Count | Animated | Clickable |
|---|---|---|---|
| Neighbor buildings | 5–7 | no | no |
| Trees | 8–12 | no | no |
| Streetlights | 4–6 | no (emissive heads) | no |
| Clouds | 4–6 | yes — one group, x-drift + wrap | no |

**Invariants**:
- Registers exactly one `world.onFrame` callback; allocates nothing per frame.
- Registers zero click targets; imports nothing from `story/`, `sync/`, `ui/`.
- Static props merged to keep added draw calls ≤ ~60.
- Props sit outside the story's travel corridors (road path, warehouse apron stay clear).

## Unchanged but re-verified

- `HighlightId` / `LocationId` sets, `anchorFor` anchors, latency constants — byte-identical.
- Click-target wiring: every v1 clickable (rooms, worker, lift, disk/courier) re-registered after the Building rework (FR-004; verified via `?dev` click-through).
- `script.ts` narration and `[[id:term]]` markers — byte-identical (FR-014).

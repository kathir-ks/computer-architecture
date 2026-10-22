# Data Model: CPU Building v2

Pure, renderer-free types (all unit-testable). Latency numbers are **never** redeclared here — they come from `src/scene/locations.ts`.

## ViewState (`src/scene/view/viewState.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `cameraMode` | `'free' \| 'follow' \| 'cinematic'` | Default `cinematic` for story, `free` equals v1 behaviour |
| `workerView` | `boolean` | First-person on/off |
| `returnMode` | `CameraMode \| null` | Set when entering Worker view; restored on exit |
| `handedBack` | `boolean` | True after learner input cancelled scripted camera; cleared by **Resume camera** |
| `xray` | `boolean` | Independent of camera |
| `quality` | `'high' \| 'medium' \| 'low'` | Step-down only automatically; manual cycling allowed |

Transitions / invariants:
- `enterWorkerView()` → `returnMode = cameraMode`, `workerView = true`, `handedBack = false`.
- `exitWorkerView()` → `cameraMode = returnMode`, `workerView = false`.
- `setCameraMode(m)` while `workerView` → updates `returnMode` only (applies on exit).
- `userGrab()` while not `workerView` → `handedBack = true`; while `workerView` → no-op (look controls are the learner's input).
- `exitWorkerView()` also restores the `handedBack` the learner had before entering; picking a mode while seated clears it (re-engages the automation).
- `resume()` → `handedBack = false` (rig re-issues the last shot request).
- Auto step-down: `high → medium → low`; never up automatically.

## Shot (`src/scene/camera/shots.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `VantageId` | Existing union + `'pipeline-line'` |
| `pos` / `target` | `[x,y,z]` | World space; all front-side (z > building front plane) |
| `fov?` | `number` | Cinematic arrival push |
| `settle?` | `number` | Seconds of arrival ease-out |

`safePath(from, to, bounds)` returns an ordered list of waypoints that never enters the tower AABB (expanded by a margin) — used by Cinematic transitions.

## FollowFraming (`src/scene/camera/follow.ts`)

Input: tracked world position `p`, velocity `v`, current camera `c`, camera look target `t`. Output: desired camera position/target such that `p` projects inside NDC ±0.85 with a minimum distance and a lead along `v`. Pure, smoothing via critically-damped step with `dt`.

## WorkerLook (`src/scene/camera/workerLook.ts`)

`clampLook({yaw, pitch}) → {yaw, pitch}` with `yaw ∈ [-65°, 100°]` (positive = toward the lift, which sits ~84° round to the Worker's right, so the right limit has to reach it), `pitch ∈ [-35°, 25°]`; `applyDrag(look, dx, dy, sensitivity)` (drag grabs the world); `lookDirection(look)`. Default gaze: yaw 28°, pitch −14°.

## AccessJourney (`src/scene/telemetry/ledger.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | number | Sequential |
| `kind` | `'load' \| 'store'` | Direction relative to registers |
| `probes` | `Array<{level: LocationId, result: 'miss' \| 'hit'}>` | De-duplicated, in order checked |
| `served` | `LocationId \| null` | Level that supplied/accepted the data |
| `cycles` | number | Running cost; final value = `locationOf(served).latencyCycles` |
| `done` | boolean | Set by `complete()` |

## CycleLedger (`src/scene/telemetry/ledger.ts`)

State: `current: AccessJourney | null`, `history: AccessJourney[]`, `idleCycles`, `workingCycles`, `elapsedCycles`.

Operations: `beginAccess(kind)`, `probe(level, result)`, `serve(level)`, `advance(deltaCycles)`, `complete()`, `work(kind)`, `reset()`, `subscribe(fn)`.

Invariants (each has a test):
1. After `complete()`, `current.cycles === locationOf(served).latencyCycles` (to the integer).
2. `idleCycles + workingCycles === elapsedCycles` at every observable moment.
3. `advance` outside an open, served journey is ignored (no double counting after `complete`).
4. `idleCycles` only increases inside an open journey served by a level other than `registers`.
5. `probe` of an already-probed level in the same journey is ignored.
6. The ledger's `Scoreboard`-compatible totals match `freeplay.applyOutcome` for the same sequence (cross-check test).

`WORK_CYCLES` (in `locations.ts`): `{ compute: 1, 'read-card': 1 }` — deliberately tiny; the contrast with waiting *is* the lesson.

## LadderState (derived, `src/ui/LevelLadder.ts`)

For each of `registers, l1, l2, ram, disk` (L1 instruction and data caches share the `l1` rung): `'idle' | 'checked-miss' | 'checked-hit' | 'served' | 'current'`, computed from `CycleLedger.current`. The "scale" layout additionally renders `latencyCycles` from `LOCATIONS` and a marker at the level currently being served.

## CacheLineSim (`src/sim/cacheLine.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `cells` | `number` | Default 16 |
| `lineSize` | `number` | Default 4; aligned lines |
| `resident` | `boolean[]` | Which cells are cached |
| `access(i)` | `{hit: boolean, filled: number[]}` | Miss fills `[floor(i/L)*L .. +L)` |
| `reset()` | — | Clears residency |

Invariants: a hit never changes residency; a miss makes the whole aligned line resident; `access` on a resident cell is always a hit.

## PipelineSchedule (`src/scene/pipelineSchedule.ts`)

Input instruction: `{ name: string; needs?: string; produces?: string; execTicks?: number }`.

Output:

| Field | Type | Notes |
|-------|------|-------|
| `ticks` | `Array<{ F: Slot; D: Slot; E: Slot }>` | `Slot = { instr: number } \| { bubble: true } \| null` |
| `totalTicks` | number | Pipelined completion time |
| `sequentialTicks` | number | Sum of 3 + extra exec ticks per instruction (the one-at-a-time baseline) |
| `bubbles` | `Array<{ tick: number; stage: 'D' \| 'E'; reason: 'dependency' \| 'memory' }>` | Drives the bubble marker + narration timing |
| `compressedMemoryTicks` | number | On-screen stand-in for a long memory wait |

Rules: an instruction advances when the next stage is free; if `needs` names a value not yet produced (written back), insert a bubble; `execTicks > 1` holds the Execute stage and stalls F/D behind it. Invariants: ≤ 1 instruction per stage per tick; program order preserved; `totalTicks ≤ sequentialTicks`; with no hazards and `n` instructions, `totalTicks === n + 2`.

## ViewPreferences / Motion

`reducedMotion: boolean` (read from the OS preference, injectable); `scaleDuration(d) → d * (reduced ? 0.35 : 1)` for camera and decorative motion only.

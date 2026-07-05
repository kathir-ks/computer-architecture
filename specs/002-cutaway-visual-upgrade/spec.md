# Feature Specification: Cutaway Visual Upgrade (v2)

**Feature Branch**: `002-cutaway-visual-upgrade`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Bring the app to the next version. Improvements in the 3D POV are needed — how users are able to view things when scenes start moving elements and graphics. The visuals need to be friendlier for humans (shapes, contrast, colors), and more realistic elements can be added." Refined through brainstorming into: cutaway dollhouse building to eliminate occlusion, pastel daylight restyle, a camera-follow behavior for moving elements with per-chapter choreography retuning, and a living environment around the building.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unobstructed view of every animation (Priority: P1)

As a learner watching the story, I can always see the element the narration is talking about — the worker, the lift car, the courier van, and every travelling data pulse — because the building presents itself as an open-faced cutaway (dollhouse / architectural section model). Walls and floor slabs never sit between me and the action, and I cannot accidentally rotate the camera to an angle where the action becomes hidden.

**Why this priority**: Occlusion is the single biggest reported viewing problem in v1. If the learner cannot see the choreography, the teaching value of every chapter is lost. All other visual work builds on this new building construction.

**Independent Test**: Play all 8 chapters start to finish and, at any point, drag the camera freely; the currently-animating element is never hidden behind a wall or slab. Delivers value on its own even with the old color scheme.

**Acceptance Scenarios**:

1. **Given** any chapter is playing a scripted animation (lift carry, courier trip, worker action, pulse travel), **When** the learner watches from the default camera position, **Then** the animating element is fully visible for the entire animation.
2. **Given** the learner grabs and rotates the camera during a chapter, **When** they reach the rotation limit, **Then** the camera stops at an angle from which room interiors are still visible (it is impossible to orbit behind the building).
3. **Given** a lift carry between any two floors, **When** the pulse travels in the lift, **Then** the lift car and its cargo are visible for the full journey (the shaft reads as transparent from the viewing side).
4. **Given** the click-to-explain free-play mode, **When** the learner clicks any previously clickable element (rooms, worker, lift, disk/courier), **Then** the same explanation behavior as v1 triggers — no clickable element is lost in the rebuild.

---

### User Story 2 - Friendly, readable visual style (Priority: P2)

As a learner, the world looks like a bright, inviting miniature diorama rather than a dark neon night scene: soft daylight, pastel room colors that differ by floor function, and strong contrast between the calm background and the vividly colored "actors" (worker, courier, pulses, highlights), so my eye is always drawn to what matters.

**Why this priority**: "Friendlier for humans" was an explicit v2 goal. Color-coded floors also answer "where am I in the building?" at a glance, reinforcing the memory-hierarchy story.

**Independent Test**: Load any chapter and compare against the v1 look: background is a light daytime tone, each functional floor group (desk, cache shelves, archive, empty floors) has a visibly distinct pastel hue, and moving/highlighted elements are clearly more saturated than their surroundings.

**Acceptance Scenarios**:

1. **Given** the app has loaded, **When** the learner views the building, **Then** the scene shows a daylight look (light sky-tone background) instead of the near-black night look.
2. **Given** two different functional floors (e.g., the desk floor and a cache-shelf floor), **When** viewed side by side in the cutaway, **Then** their interior colors are visibly distinct.
3. **Given** a chapter changes mood (intro, working, tense-miss, celebration), **When** the mood shifts, **Then** the ambience visibly changes while remaining within the daylight style (no return to near-black).
4. **Given** a hit/miss/focus flash or a hover highlight, **When** it plays against the new pastel surfaces, **Then** the flash color is clearly distinguishable from the room color (hit, miss, and focus remain three visually distinct signals).

---

### User Story 3 - Camera follows the action (Priority: P3)

As a learner, when something travels a long distance — the courier van driving to the warehouse, the lift carrying data up many floors — the camera smoothly tracks the moving element from outside the building instead of staring at a fixed spot, so I never lose the thread of the story. If I grab the camera myself, my input instantly wins.

**Why this priority**: Fixed vantage points made long journeys feel distant and easy to lose in v1. Tracking shots make the story cinematic and keep attention anchored, but they only make sense after the cutaway (US1) guarantees visibility.

**Independent Test**: Trigger a courier trip and a multi-floor lift carry (via story chapters or the dev choreography page); the camera visibly tracks each moving element for the duration of the trip, and a mid-trip user drag immediately stops the scripted tracking.

**Acceptance Scenarios**:

1. **Given** a chapter plays a courier trip to the warehouse, **When** the van drives, **Then** the camera's aim continuously follows the van until it arrives.
2. **Given** a chapter plays a long lift carry, **When** the lift travels, **Then** the camera's aim follows the lift car during the journey.
3. **Given** the camera is following a moving element, **When** the learner grabs the canvas, **Then** scripted camera motion stops immediately and the learner has full manual control (same rule as v1 fly-to moves).
4. **Given** the retuned per-chapter choreography, **When** each chapter plays end to end, **Then** narration paragraphs and animation cues remain in one-to-one correspondence (no chapter gains or loses a narration step).

---

### User Story 4 - A living world outside the building (Priority: P4)

As a learner, the CPU building sits in a small living neighborhood — a few neighbor buildings, trees, streetlights along the road, and clouds drifting slowly across the sky — so the scene feels like a real place rather than a lone tower floating in darkness.

**Why this priority**: Pure atmosphere. It makes the metaphor more relatable ("the disk warehouse is across town") but teaches nothing by itself, so it comes last.

**Independent Test**: Load the app and look around the exterior: neighbor buildings, trees, and streetlights are present along the road, and at least a few clouds visibly drift over ~30 seconds of watching. None of them react to clicks or interfere with the story.

**Acceptance Scenarios**:

1. **Given** the app has loaded, **When** the learner looks at the surroundings, **Then** the road between building and warehouse passes through visible set dressing (neighbor buildings, trees, streetlights).
2. **Given** the learner watches the sky for a short while, **When** clouds drift, **Then** the motion is slow and continuous without stutter.
3. **Given** free-play click-to-explain mode, **When** the learner clicks any environment prop, **Then** nothing happens — only the original teaching elements respond.
4. **Given** the low-quality mode used on weak machines, **When** the app runs, **Then** the environment does not push the app below its performance target (set dressing may simplify if needed).

### Edge Cases

- Learner grabs the camera mid-follow: scripted tracking must die instantly and never "fight" the learner afterwards (matches the existing grab-wins rule).
- Deep link into a late chapter (`#chapter-N`): the cutaway building, environment, and retuned vantage points must be fully in place, exactly as the v1 pre-reveal rule ensures rooms are revealed.
- Camera rotation limits vs. saved habits: learners used to orbiting fully around in v1 will hit the new limits; the stop must feel like a smooth boundary, not a snap or jitter.
- No-WebGL fallback: the static illustrated fallback keeps rendering the unchanged narration text; the visual restyle does not alter or fork any narration content.
- Performance watchdog: if the frame rate drops below target with the new environment and daylight look, the existing auto-degrade behavior (e.g., bloom off) must still recover smoothness.
- Follow target finishes early or is disposed (e.g., pulse delivered) while a follow is still active: the camera must settle gracefully at the destination, not chase a vanished object.
- Narrow screens (below ~900px, bottom-drawer layout): the cutaway framing must still keep the active floor visible above the drawer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The building MUST present as an open-faced cutaway: every room interior on all 10 floors is visible from the front viewing arc without any dynamic transparency or wall-hiding tricks.
- **FR-002**: Camera rotation MUST be limited to a front viewing arc from which room interiors remain visible; vertical tilt limits MUST likewise prevent angles where floor slabs hide the action.
- **FR-003**: The lift MUST be visible for the entire duration of every carry, including its cargo, from anywhere within the allowed viewing arc.
- **FR-004**: All v1 clickable teaching elements (rooms, worker, lift, disk/courier) MUST remain clickable with unchanged explanation behavior after the rebuild.
- **FR-005**: The scene MUST use a daylight pastel style: light background/sky tone, higher overall brightness, and pastel interior colors with a visibly distinct hue per functional floor group.
- **FR-006**: Moving and highlighted elements (worker, courier, lift car, pulses, glows, flashes) MUST be visually more saturated/prominent than static surroundings so attention is drawn to the action.
- **FR-007**: The four existing mood states MUST remain and MUST be re-expressed as daylight variants; mood changes stay smooth transitions.
- **FR-008**: Hit, miss, and focus signals MUST remain three clearly distinguishable colors against the new pastel surfaces.
- **FR-009**: The scene layer MUST expose a new "follow" behavior that keeps the camera aimed at a nominated moving element (courier, lift, or a travelling pulse) for a bounded duration, usable by story choreography like any other scene verb.
- **FR-010**: A user grab of the canvas MUST immediately cancel any scripted camera motion, including follow.
- **FR-011**: If a followed element is delivered/disposed before the follow ends, the camera MUST settle at the element's last destination without error.
- **FR-012**: Existing chapter choreography MUST be retuned for the cutaway: vantage framings updated for the open face, and follow shots added to courier trips and long lift carries — without changing any narration text or the count of narration steps per chapter.
- **FR-013**: The world outside the building MUST include static set dressing (neighbor buildings, trees, streetlights along the road) and slowly drifting clouds; environment props MUST NOT respond to clicks and MUST NOT participate in the story.
- **FR-014**: All narration text MUST remain byte-identical to v1; the no-WebGL fallback continues to render from the same single source.
- **FR-015**: The new visuals MUST respect the existing performance safeguards: low-quality mode still works, the auto-degrade watchdog still recovers ~30fps on modest hardware, and the app still ships as a fully static site with procedural geometry only.
- **FR-016**: The scene–story separation MUST be preserved: the follow behavior and all visual changes live in the scene layer; story files only sequence verbs.

### Key Entities

- **Cutaway building**: The 10-floor open-faced structure; each floor is a dressed, colored room interior visible from the front arc; front face carries the transparent lift shaft.
- **Viewing arc**: The allowed range of camera orbit angles (horizontal and vertical) within which all rooms remain visible; the boundary of learner camera freedom.
- **Follow behavior**: A time-bounded camera instruction that tracks one nominated moving element; cancellable by user grab; part of the scene-verb vocabulary alongside fly-to.
- **Floor palette**: The mapping from functional floor group (desk, cache shelves, archive, empty, warehouse) to its pastel interior hue; the single source of the color-coding story.
- **Environment set**: The collection of non-interactive exterior props (neighbor buildings, trees, streetlights, clouds) plus the cloud-drift motion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across a full playthrough of all 8 chapters, the currently-animating element is visible on screen for 100% of every scripted animation when viewed from the default camera positions (verified against the per-chapter manual checklist).
- **SC-002**: From any camera angle the learner can reach, at least the active floor's interior is visible — 0 reachable angles where a wall or slab fully hides the current action.
- **SC-003**: In an informal look test, a first-time viewer can point to which floor is "the desk", "the shelves", and "the archive" within 10 seconds of seeing the cutaway, using color/dressing alone.
- **SC-004**: During courier trips and multi-floor lift carries, the moving element stays within the central two-thirds of the frame for the duration of the trip.
- **SC-005**: The app maintains ~30fps or better on integrated graphics with the new environment active, and low-quality mode still loads and plays all chapters.
- **SC-006**: All existing automated tests (unit + smoke) pass; the cue-integrity guarantee (every chapter uses only real scene verbs, narration steps = cue count) holds with the new follow verb included.
- **SC-007**: Every clickable element from v1 still triggers its explanation in free-play mode (manual click-through of the full element list).

## Assumptions

- The night-neon theme is fully replaced by the daylight pastel style; no theme toggle or "classic look" option is kept.
- Losing the ability to orbit behind the building is acceptable; nothing story-relevant exists there.
- Room props and characters stay stylized (boxes and simple shapes); realism investment goes into the exterior environment only, per brainstorming decisions.
- Narration/script content is out of scope; only camera framing and animation cues within chapters may change, preserving the one-narration-step-per-cue pairing.
- The bloom/glow effect is retained but tuned down to suit daylight; it remains toggleable and auto-disabling as today.
- The existing static-site, procedural-geometry-only constraint applies to all new environment props (no downloaded models or textures).
- The follow behavior is expected to be reused by the future pipelining chapter; it is designed as a general verb, not a courier-specific effect.

# Feature Specification: CPU Building v2 — Richer Visuals, More Viewpoints, New Visualizations, Pipelining

**Feature Branch**: `002-cpu-building-v2`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "CPU Building v2 — 'Next version' upgrade of the existing 3D explainer. (1) Graphics: replace flat dark boxes with a lit, detailed, readable building — realistic-looking materials, window/floor detail, ambient lighting, soft shadows, improved glow, particle trails on moving data, a more characterful Worker, with a quality fallback for weak GPUs. (2) Animations: smoother easing, anticipation/follow-through, data cards that visibly travel, cache hit/miss feedback, idle-time foot-tapping. (3) Points of view: follow-the-data camera that tracks the traveling card between floors; Worker first-person view; X-ray/cross-section toggle with floor labels and a side latency scale; cinematic auto-directed tour camera between story beats; user input always wins over scripted camera. (4) New visualizations: live latency/cycle meter, memory-hierarchy ladder diagram synced to the 3D scene, Worker idle-time counter, cache-line/locality animation. (5) New chapter: Pipelining (overlapping fetch/decode/execute — assembly-line view, hazards/stalls), added without reworking existing chapters."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A building that is clear, lit and good to look at (Priority: P1)

A student opens the site and sees a building that reads instantly: every floor is lit and visibly distinct, rooms have recognisable furniture (shelves, desks, drawers, crates), surfaces look solid rather than flat, and moving data leaves a visible trail. The Worker is a recognisable character with posture and expression-like motion rather than a block. On a weak laptop the scene automatically drops to a lighter look without breaking anything, and the learner can switch the look manually.

**Why this priority**: First impressions and legibility decide whether a learner stays. Today the scene is very dark and the rooms are hard to tell apart, so every other improvement (cameras, meters, new chapter) is wasted if the learner cannot read the scene.

**Independent Test**: Open the site on a normal laptop and on a throttled/low-end configuration. In both, every one of the 10 floors and the warehouse can be identified at a glance on first load, labels remain readable, and the frame rate target is met after any automatic quality step-down.

**Acceptance Scenarios**:

1. **Given** a fresh page load at the default camera, **When** the learner looks at the building, **Then** all occupied rooms (desk, L1 shelves, L2 storeroom, RAM archive, warehouse) are distinguishable by shape and colour without relying on labels alone.
2. **Given** data moving between floors, **When** it travels, **Then** it leaves a short fading trail that makes direction and speed obvious.
3. **Given** the Worker is idle, working or waiting on memory, **When** the learner watches, **Then** each state has a clearly different, readable body animation.
4. **Given** sustained low frame rate, **When** the watchdog triggers, **Then** the scene steps down to the lighter look automatically and the story continues uninterrupted; the learner can switch back manually.
5. **Given** a browser without 3D support, **When** the page loads, **Then** the existing illustrated static fallback is shown with all narration, now including the new chapter.

---

### User Story 2 - Follow the data and a directed tour (Priority: P1)

The learner can choose how they watch. In **Follow the data** mode the camera glides along with the traveling card or pulse as it moves between floors and across the street, so the learner never loses track of it. In **Cinematic** mode the camera is directed: it dollies, orbits and settles on each story beat. In both modes, the moment the learner touches the camera, the learner is in control and the story carries on unbroken; a clearly visible control lets them hand the camera back.

**Why this priority**: Following the journey is the core of the memory-hierarchy lesson, and the current fixed shots cause the data to leave the frame during long trips (RAM, disk).

**Independent Test**: Play chapters 5–7 in each camera mode. The traveling item stays in frame for the whole journey in Follow mode; Cinematic mode shows a distinct, smooth shot per beat; dragging the view at any time hands control to the learner immediately.

**Acceptance Scenarios**:

1. **Given** Follow mode and a data item traveling from RAM to the desk, **When** it moves, **Then** it remains in frame throughout and the camera motion is smooth with no sudden jumps.
2. **Given** Cinematic mode, **When** the story advances to a new beat, **Then** the camera transitions to that beat's shot with smooth movement and without clipping through walls.
3. **Given** any scripted camera motion, **When** the learner drags, scrolls or pinches the view, **Then** scripted motion stops at once and does not fight the learner.
4. **Given** the learner has taken control, **When** they choose "Resume camera", **Then** the selected mode resumes from the current beat without restarting the chapter.
5. **Given** pause, **When** the story is paused, **Then** camera automation pauses too.

---

### User Story 3 - See through the Worker's eyes (Priority: P2)

The learner can step into a first-person view from the Worker's desk: drawers (registers) within reach, the ticket dispenser to one side, the lift door ahead where cards arrive. They feel how quickly data arrives from a drawer or an L1 hit versus the long empty wait for a RAM or disk trip, from the Worker's point of view. The learner can look around within a sensible range and leave the view at any time.

**Why this priority**: The "waiting" feeling is the emotional heart of the lesson, and it lands hardest from the Worker's seat. It builds on the existing scene without changing the story.

**Independent Test**: From any chapter, enter Worker view; fire a free-play LOAD from L1 and one from RAM and compare how long the incoming-card door stays empty; then exit and confirm the previous camera mode is restored.

**Acceptance Scenarios**:

1. **Given** any point in the story, **When** the learner selects Worker view, **Then** the camera moves to the Worker's seat with the desk, drawers, dispenser and lift door in view.
2. **Given** Worker view and a data request, **When** the data takes a long time, **Then** the learner sees the lift door stay empty for the proportionally long wait, with the idle state visible.
3. **Given** Worker view, **When** the learner looks around, **Then** the view is limited to a comfortable range that never shows inside-out geometry.
4. **Given** Worker view, **When** the learner exits, **Then** the previous camera mode and position are restored.

---

### User Story 4 - X-ray cross-section and latency scale (Priority: P2)

The learner toggles an X-ray cross-section: the building becomes a clean architectural section with every floor labelled by role, and a vertical scale on the side shows how far each level is in cycles. Floors and rooms light up in step with the story, so the physical "distance" and the numeric cost are shown together.

**Why this priority**: It converts the metaphor into the actual numbers (0 / 4 / 12 / 200 / millions of cycles) in one glance, which is the key takeaway of the product.

**Independent Test**: Toggle X-ray in each chapter; all floors are labelled, the scale shows the five latencies, and the item currently being fetched is marked on the scale in real time.

**Acceptance Scenarios**:

1. **Given** X-ray is switched on, **When** the learner views the building, **Then** floor labels and the side latency scale are visible and legible, and non-essential decoration is faded.
2. **Given** data is traveling, **When** it passes each level, **Then** that level's mark on the scale lights up in sync.
3. **Given** X-ray is switched off, **When** toggled, **Then** the building returns smoothly to the full look.
4. **Given** the latency values defined for the product, **When** the scale renders, **Then** it shows exactly those values and never a separate copy.

---

### User Story 5 - Live visualizations that make the numbers felt (Priority: P2)

Alongside the 3D view, the learner sees small live visual aids that stay in sync with the scene: a **cycle meter** that counts the cost of the current access as it happens; a **memory ladder** diagram (registers → L1 → L2 → RAM → disk) where the current access lights up each rung it checks; an **idle-time counter** showing how many cycles the Worker has spent waiting versus working; and a **locality animation** showing how one fetched block (a cache line) brings neighbouring items along so the next accesses hit.

**Why this priority**: These turn passive watching into quantified understanding and make the free-play mode far more instructive. They are additive and can ship piecemeal.

**Independent Test**: Run a miss cascade and a happy-path hit; the meter's final value matches the defined latency for the level that served the request, the ladder lights exactly the levels checked, the idle counter increases only while the Worker waits, and the locality view shows neighbours becoming hits.

**Acceptance Scenarios**:

1. **Given** a cache hit at L1, **When** the access completes, **Then** the meter reads the L1 cost and the ladder shows only the registers/L1 rungs engaged.
2. **Given** a miss cascade to RAM, **When** the access completes, **Then** the ladder shows each missed level in order and the meter ends at RAM's defined cost (200 cycles).
3. **Given** the Worker waiting on memory, **When** time passes in the scene, **Then** the idle counter rises in proportion and stops when data arrives.
4. **Given** the locality animation, **When** a block is brought in from RAM, **Then** neighbouring items visibly arrive with it and the following accesses to them are shown as hits.
5. **Given** free-play, **When** the learner fires requests, **Then** the meter, ladder, idle counter and existing scoreboard all update consistently with each other.
6. **Given** a narrow screen, **When** the aids don't fit, **Then** they collapse into a compact form rather than covering the 3D view.

---

### User Story 6 - New chapter: Pipelining (Priority: P3)

After the existing eight chapters, a ninth chapter explains pipelining: instead of finishing one card before starting the next, the building runs an assembly line where Fetch, Decode and Execute work on three different cards at once. The learner watches the line fill, sees throughput increase, then meets a **hazard**: a card needing a result that is not ready yet, causing a visible stall ("bubble") that ripples down the line. They finish understanding why waiting on memory also stalls the whole line.

**Why this priority**: It extends the story naturally and is the long-planned next chapter, but the product is whole without it. It must be purely additive.

**Independent Test**: Open the ninth chapter directly by its address and step through it; confirm the assembly line, the fill, the speed-up, the stall, and the recovery all play and that chapters 1–8 are unchanged in behaviour.

**Acceptance Scenarios**:

1. **Given** the end of chapter 8, **When** the learner continues, **Then** chapter 9 begins and the progress indicator shows nine chapters.
2. **Given** the assembly line running, **When** it is full, **Then** three cards are visibly in three different stages at the same moment, and the completed-instructions rate is shown as higher than the one-at-a-time rate.
3. **Given** a hazard, **When** a dependent card reaches the stage that needs the missing result, **Then** a visible bubble forms, later cards wait behind it, and normal flow resumes afterwards.
4. **Given** the no-3D fallback, **When** chapter 9 is viewed, **Then** its narration is present in the static page.
5. **Given** the free-play unlock, **When** the learner reaches it, **Then** it now unlocks after chapter 9 and still works as before.

---

### User Story 7 - Smoother, more expressive animation (Priority: P3)

Motion throughout feels deliberate: a short wind-up before something launches, a soft settle after it lands, lifts that accelerate and decelerate naturally, cards that visibly travel with a readable shape, a satisfying cue for a cache hit, and a distinct, slightly worrying cue for a miss. The Worker's foot-tapping and posture make waiting obvious without reading the narration.

**Why this priority**: It refines every chapter but is hard to judge in isolation; much of it ships alongside Stories 1 and 2.

**Independent Test**: Run the happy-path and miss-cascade chapters and compare against the existing manual per-chapter checklist; hit and miss are distinguishable with the sound off and with colour-blind simulation on.

**Acceptance Scenarios**:

1. **Given** a hit and a miss, **When** each plays, **Then** they differ in motion and shape, not only in colour.
2. **Given** a user who prefers reduced motion, **When** the operating system setting is on, **Then** camera moves become gentler and decorative motion is minimised while teaching animations still play.
3. **Given** any animation, **When** paused and resumed, **Then** it continues without jump or glitch.

---

### Edge Cases

- Learner switches camera mode, X-ray or Worker view mid-animation: the animation continues and the new view takes effect smoothly; nothing restarts or desynchronises.
- Learner jumps to a chapter by address while in Worker view or X-ray: the view settings persist sensibly or reset to defaults, never leaving a blank or broken scene.
- Follow mode while the traveling item is hidden or removed (animation ends): the camera settles on the destination instead of snapping.
- The learner deep-links straight to chapter 9 and skips earlier reveals: all rooms are already revealed (same rule as the existing deep-link behaviour).
- Very small or very large windows and touch devices: aids and toggles remain reachable; touch drag/pinch counts as taking control.
- Tab hidden and restored mid-journey: meters and counters do not jump or double-count.
- Weak graphics hardware: lighter look is automatic; the X-ray and Worker view still work in it.
- Reduced-motion preference set: no strobing flashes; cinematic camera moves shorten or become cuts.
- Page loaded in the no-3D fallback: all new narration appears; interactive aids that depend on 3D are simply absent without errors.

## Requirements *(mandatory)*

### Functional Requirements

**Visual quality**

- **FR-001**: Every occupied room and floor MUST be clearly lit and distinguishable at the default view without relying on text labels.
- **FR-002**: Rooms MUST contain recognisable props appropriate to what they represent (e.g. desk, drawers, ticket dispenser, instruction and data shelves, storeroom crates, archive stacks, warehouse bays).
- **FR-003**: Surfaces MUST appear solid and varied (distinct material looks for walls, floors, glass, metal, glowing elements), with visible depth cues such as soft shadows or equivalent.
- **FR-004**: Moving data MUST leave a fading trail whose length and speed reflect its movement.
- **FR-005**: The Worker MUST have a recognisable character with distinct body animations for idle, working, reading a card and waiting-on-memory.
- **FR-006**: The system MUST offer at least two quality levels, automatically step down on sustained low frame rate, and let the learner switch manually (retaining the existing behaviour and thresholds).
- **FR-007**: All visuals MUST remain procedurally generated with no downloaded models or textures.

**Animation**

- **FR-008**: Camera moves and lift travel MUST use natural acceleration and deceleration; launches MUST have a brief wind-up and arrivals a brief settle.
- **FR-009**: Data items MUST be visibly distinct shapes (card vs data block) so the learner can tell an instruction from a value in motion.
- **FR-010**: Cache hit and miss feedback MUST differ in motion and shape as well as colour.
- **FR-011**: The Worker's waiting animation MUST be visible whenever the story or free-play is waiting on a slower level than registers.
- **FR-012**: When the system reports a reduced-motion preference, camera transitions MUST be shortened or replaced by cuts and decorative looping motion MUST be minimised.

**Viewpoints**

- **FR-013**: The learner MUST be able to choose between at least three camera modes: Free (current behaviour), Follow-the-data, and Cinematic.
- **FR-014**: In Follow mode, the traveling item MUST remain in frame for its entire journey, including the trip across the street.
- **FR-015**: In Cinematic mode, each story beat MUST have a defined shot, with transitions that do not pass through walls or floors.
- **FR-016**: Any learner camera input (mouse, wheel, touch, keyboard) MUST immediately cancel scripted camera motion; a visible control MUST let the learner hand control back.
- **FR-017**: The learner MUST be able to enter and leave a Worker first-person view at any time, with the previous mode restored on exit.
- **FR-018**: Worker view MUST show the desk, drawers, ticket dispenser and the lift door, and MUST limit how far the view can be turned.
- **FR-019**: Camera automation MUST pause and resume together with the story.

**X-ray and scale**

- **FR-020**: The learner MUST be able to toggle an X-ray cross-section that labels every floor by its role and fades non-essential decoration.
- **FR-021**: A vertical latency scale MUST show each level's cost in cycles using the single existing source of latency values, and MUST mark the level currently being accessed in sync with the scene.

**Live visualizations**

- **FR-022**: A cycle meter MUST show the running cycle cost of the current access and the final cost, which equals the defined latency of the level that served it (the product's latency figures are the total cost of an access served by that level, e.g. a RAM access costs 200, not 4 + 12 + 200; missed levels are shown on the ladder, not added to the meter).
- **FR-023**: A memory ladder diagram MUST engage rungs in the same order and at the same moments as the 3D data journey.
- **FR-024**: An idle-time counter MUST show cycles spent waiting versus working, increasing only while the Worker is waiting.
- **FR-025**: A locality animation MUST demonstrate that a fetched block brings neighbouring items with it and that nearby follow-up accesses then hit.
- **FR-026**: All aids MUST stay consistent with each other and with the free-play scoreboard, and MUST collapse to a compact form on narrow screens without covering the 3D view's focus area.

**Pipelining chapter**

- **FR-027**: A ninth chapter, "Pipelining", MUST be added after chapter 8, with narration in the single narration source, reachable by its own address, included in the progress indicator and in the no-3D fallback.
- **FR-028**: The chapter MUST show three instructions occupying fetch, decode and execute at the same time, and MUST show that the completion rate is higher than one-at-a-time.
- **FR-029**: The chapter MUST show a hazard producing a visible stall (bubble) that delays later instructions, then recovery, and MUST relate the stall to memory waits.
- **FR-030**: Free-play MUST unlock after the new final chapter.
- **FR-031**: Chapters 1–8 MUST behave exactly as before in content and sequence; the new chapter MUST be purely additive.

**Preservation of constraints**

- **FR-032**: The 3D layer MUST remain unaware of chapters, and the story layer MUST remain unaware of rendering details; any new capability MUST be exposed as named actions the story can sequence.
- **FR-033**: All narration MUST remain editable in the single narration source; latency values in the single latency source; pacing values in the single pacing source.
- **FR-034**: The site MUST remain a static site with no network calls after load and deployable to the existing static hosting pipeline.
- **FR-035**: All existing automated tests and smoke tests MUST continue to pass, and new non-visual logic (cycle accounting, idle accounting, ladder state, pipeline schedule, camera-mode state, preference handling) MUST have automated tests.

### Key Entities

- **Camera Mode**: Free, Follow-the-data, Cinematic, Worker view; has an active/handed-back-to-learner state; remembers the mode to return to when leaving Worker view.
- **Shot**: A named camera position/look-at/duration associated with a story beat or location; used by Cinematic mode.
- **Access Journey**: One request for data — the ordered list of levels checked, which level served it, hit or miss at each, and cumulative cycles; drives the meter, ladder, idle counter, X-ray scale marker, and 3D motion from the same record.
- **Wait State**: Whether the Worker is currently waiting and for how many cycles; drives the idle counter and the waiting animation.
- **Cache Line / Block**: A group of neighbouring items brought in together; used by the locality animation.
- **Pipeline Schedule**: For a list of instructions, which stage each occupies at each tick, including hazards and stall bubbles; drives the assembly-line view and throughput comparison.
- **View Preferences**: Quality level, X-ray on/off, camera mode, reduced-motion; session-scoped.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a usability check with at least 5 first-time viewers, at least 4 can correctly name what each of the five rooms/areas represents from the default view within 30 seconds of the first load, with labels hidden.
- **SC-002**: The experience maintains at least 30 frames per second on an average college laptop with integrated graphics, either at the default level or after the automatic step-down, in every chapter.
- **SC-003**: In Follow mode, the traveling item stays within the visible frame for 100% of the journey in chapters 5, 6, 7 and free-play, verified by an automated frame check at sampled moments.
- **SC-004**: From the moment the learner touches the view, scripted camera movement stops within 100 ms in 100% of attempts.
- **SC-005**: For every access type (L1 hit, L2 hit, RAM, disk), the cycle meter's final value equals the defined latency exactly, and the sum of the idle counter plus working time equals total elapsed cycles, in 100% of automated test cases.
- **SC-006**: At least 4 of 5 first-time viewers can state, after chapter 6 with the aids visible, roughly how much slower RAM is than L1 (within a factor of 2 of the true ratio), up from the pre-change baseline measured on the same chapter without the aids.
- **SC-007**: At least 4 of 5 first-time viewers can explain, after chapter 9, why a pipeline stall happens and that memory waits cause it.
- **SC-008**: Chapters 1–8 pass the existing manual choreography checklist and the full existing automated and smoke suites with no regression.
- **SC-009**: The page's initial load completes in under 5 seconds on a typical broadband connection, and the total download size grows by no more than 25% compared with the current version.
- **SC-010**: Every new toggle (camera mode, Worker view, X-ray, quality) can be switched in any chapter without leaving the scene in a broken state, verified by an automated switch-sequence test.

## Assumptions

- The existing eight chapters, narration voice and structure are good and are kept; only the presentation around them is upgraded and one chapter is added.
- Target remains desktop browsers first; touch input must work for camera control, but a full phone-optimised layout beyond the existing narrow-width drawer is out of scope.
- No audio in this version; hit/miss cues are visual (audio can be a later addition).
- All state (camera mode, X-ray, quality) lasts for the session only; nothing is stored beyond that and no accounts or network services are involved.
- The latency numbers (0 / 4 / 12 / 200 / 4,000,000 cycles) are unchanged.
- The pipeline chapter uses a classic three-stage line (fetch, decode, execute) for clarity; deeper pipelines, branch prediction and out-of-order execution are out of scope.
- Delivery follows constitution milestones: work can ship in slices — visuals and camera first, then X-ray and live aids, then the pipelining chapter — each deployed and viewable before the next begins.
- Learner-first clarity (constitution I) wins any conflict: an effect that looks impressive but makes the data's journey harder to follow is dropped.
- Sample sizes in the usability criteria are small informal checks, not formal studies.

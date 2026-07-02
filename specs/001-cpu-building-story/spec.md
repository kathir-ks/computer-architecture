# Feature Specification: CPU Building Story — Interactive 3D Memory Hierarchy Explainer

**Feature Branch**: `001-cpu-building-story`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "An interactive, web-based 3D explainer that teaches CPU fundamentals — the fetch–decode–execute cycle and the memory hierarchy — through a spatial story: the CPU is a 10-story building, memory latency is felt as physical travel time. Guided narrated story first; free-play mode after. Cutaway building with neon data pulses; side narration panel with synchronized term highlighting; desktop browser on GitHub Pages."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Follow the guided story (Priority: P1)

A student learning computer architecture opens the site and follows an 8-chapter narrated story set in a 10-story cutaway building: they meet the Worker (the core) on floor 10 with register drawers at the desk, see instruction and data shelves (L1) one floor below, a bigger L2 storeroom below that, a vast RAM archive on floor 4, and a disk warehouse across the street. Advancing step by step with a Next button, they watch fetch, decode, and execute play out, then feel the memory hierarchy through travel time: a one-floor lift hop for an L1 hit, a long ride to floor 4 on a miss cascade, and a comically slow courier van trip for the disk. They can pause and orbit the camera freely at any moment without breaking the story.

**Why this priority**: This is the product — the story alone delivers the full learning outcome. Everything else amplifies it.

**Independent Test**: Open the site, click Next through all 8 chapters. Verify each chapter's narration appears, its animation plays to completion, camera orbiting works throughout, and pause/resume continues mid-animation exactly where it stopped.

**Acceptance Scenarios**:

1. **Given** a fresh page load, **When** the user clicks Next repeatedly, **Then** the story advances through all 8 chapters in order (building tour → the Worker's job → fetch → decode → execute/happy path → miss cascade → disk trip → recap), each step showing its narration paragraph and playing its animation.
2. **Given** an animation is playing, **When** the user pauses, **Then** all motion freezes, and resume continues from exactly that point.
3. **Given** an animation is playing, **When** the user drags to orbit the camera, **Then** the camera obeys the user immediately and the story continues without breaking.
4. **Given** chapter 6 (miss cascade) is playing, **When** the data is found missing at each level, **Then** the journey visibly continues downward level by level and a timing comparison shows the growing cycle costs (register ≈ 0, L1 = 4, L2 = 12, RAM = 200).
5. **Given** any chapter, **When** the user copies the page address and opens it in a new tab, **Then** the story opens at that chapter.

---

### User Story 2 - Connect words to the world (Priority: P2)

While reading the narration, the student hovers a highlighted term like "L1 cache" and sees the matching part of the building glow. Conversely, clicking any labeled part of the 3D world scrolls the narration to where that concept is explained and flashes it. The words and the world stay connected in both directions.

**Why this priority**: The two-way link between text and 3D is what turns watching into understanding, but the story works (with plain labels) without it.

**Independent Test**: On any chapter, hover each highlighted term and confirm the correct 3D element glows; click each labeled 3D element and confirm the panel scrolls to its explanation.

**Acceptance Scenarios**:

1. **Given** narration containing a highlighted term, **When** the user hovers it, **Then** the corresponding 3D element gains a visible glow that ends when the hover ends.
2. **Given** a labeled element in the 3D scene, **When** the user clicks it, **Then** the narration panel scrolls to and briefly flashes the first mention of that concept.

---

### User Story 3 - Learn by playing (Priority: P3)

After finishing the story, the panel unlocks a free-play mode. The student composes their own requests — pick an operation (LOAD / ADD / STORE) and where the data lives (L1 / L2 / RAM / disk / random) — and fires them. The same building animations play out while a live cycle counter racks up, and a scoreboard tallies cache hits vs. misses, letting the locality lesson sink in through experimentation.

**Why this priority**: Play cements the intuition, but it depends on the story world existing first and adds no new concepts.

**Independent Test**: Complete the story, then fire each operation × each data location; verify the correct journey animates, the cycle counter matches the location's cost, and the scoreboard tallies hits and misses correctly.

**Acceptance Scenarios**:

1. **Given** the story is completed, **When** the recap chapter ends, **Then** free-play controls appear in the panel.
2. **Given** free-play mode, **When** the user fires a LOAD with data in RAM, **Then** the lift journey to floor 4 plays and the cycle counter shows the RAM cost.
3. **Given** several fired instructions, **When** the user checks the scoreboard, **Then** hits and misses are tallied consistently with what was animated.

---

### Edge Cases

- Browser cannot render 3D at all → show a static labeled illustration of the building with the full story text readable below; the lesson survives without 3D.
- Sustained low frame rate on weak hardware → visual quality (glow effects) automatically steps down; a manual quality toggle is also available.
- Window narrower than ~900px → the narration panel folds into a bottom drawer; nothing becomes unreachable.
- Browser tab hidden mid-animation → animation pauses; returning resumes it (story never plays to an empty room).
- User mashes Next during an animation → the current step completes or fast-forwards cleanly; steps never overlap or interleave.
- Page opened with an invalid chapter address → falls back to chapter 1.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The experience MUST present a 10-story cutaway building where floor 10 is the core (with the Worker and register drawers), floor 9 holds separate instruction and data shelves (L1), floor 8 a larger storeroom (L2), floor 4 a large archive (RAM), and a warehouse outside the building (disk); other floors exist but are dark and unlabeled.
- **FR-002**: The story MUST comprise 8 chapters in fixed order: building tour, the Worker's job, fetch, decode, execute + happy path, miss cascade, disk trip, recap + free-play unlock.
- **FR-003**: Users MUST advance the story one step at a time via a Next control; each step pairs one narration paragraph with one animation.
- **FR-004**: Narration MUST accumulate in a side panel like a book (previous paragraphs remain visible, dimmed), with chapter progress shown.
- **FR-005**: Users MUST be able to pause and resume mid-animation, resuming exactly where frozen.
- **FR-006**: Camera orbit MUST remain available at all times; scripted camera moves MUST yield instantly to user input.
- **FR-007**: Data movement MUST be depicted as glowing pulses traveling via the lift (between floors) or courier van (to/from the warehouse), with travel duration reflecting relative latency.
- **FR-008**: The story MUST present relative latency figures (register ≈ 0, L1 = 4 cycles, L2 = 12, RAM = 200, disk = millions) in a visual timing comparison during the miss cascade and recap.
- **FR-009**: Highlighted terms in narration MUST glow their corresponding 3D elements on hover; clicking a labeled 3D element MUST scroll the narration to its explanation (both directions, in story and free play).
- **FR-010**: The current chapter MUST be reflected in the page address so any chapter can be bookmarked or shared; invalid addresses fall back to chapter 1.
- **FR-011**: After the recap chapter, a free-play mode MUST unlock: users compose operation (LOAD / ADD / STORE) × data location (L1 / L2 / RAM / disk / random), fire it, and watch the corresponding journey with a live cycle counter and a hit/miss scoreboard.
- **FR-012**: When 3D rendering is unavailable, the page MUST fall back to a static labeled illustration with the full story text.
- **FR-013**: Visual quality MUST include a manual toggle and MUST automatically reduce effects if the frame rate falls below roughly 30 fps.
- **FR-014**: Below ~900px viewport width, the narration panel MUST fold into a bottom drawer with all controls still usable.
- **FR-015**: When the browser tab is hidden, animations MUST pause and resume on return.

### Key Entities

- **Chapter / Step**: A chapter is an ordered list of steps; a step is one narration paragraph paired with one animation sequence. The story is the ordered list of chapters.
- **Location**: A place in the world representing a memory level (registers, L1i, L1d, L2, RAM, disk) with a name, a floor/position, and a relative latency in cycles.
- **Term marker**: A span of narration text bound to a location or scene element identifier, powering two-way highlighting.
- **Free-play request**: An operation (LOAD / ADD / STORE) plus a data location; produces a journey, a cycle cost, and a hit/miss outcome.
- **Scoreboard**: Running tally of hits, misses, and total cycles across free-play requests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student with no prior architecture coursework can complete the full story, unprompted, in 20 minutes or less.
- **SC-002**: After one pass through the story, the learner can correctly order registers, L1, L2, RAM, and disk from fastest to slowest, and explain in one sentence why caches exist.
- **SC-003**: The experience runs without visible stutter on an average college laptop with integrated graphics.
- **SC-004**: Every chapter is directly reachable via a shared link on first load.
- **SC-005**: With 3D unavailable, 100% of the story text remains readable and the memory-hierarchy illustration is understandable.
- **SC-006**: In free play, 100% of fired requests animate the correct journey and report a cycle cost consistent with the story's latency figures.

## Assumptions

- Primary audience is a desktop browser user; small screens get graceful degradation, not a designed mobile experience.
- Narration is in English; latency figures are illustrative teaching numbers, not vendor-accurate.
- Single anonymous learner; no accounts, persistence, or progress tracking beyond the chapter address in the URL.
- Pipelining, L3, multicore, branch prediction, and virtual memory are out of scope for this feature and are planned as future additive chapters.
- The founding design document (`docs/superpowers/specs/2026-07-03-cpu-building-3d-design.md`) governs visual style and analogy details not restated here.

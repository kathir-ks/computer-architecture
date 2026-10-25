/**
 * ALL narration text lives here (constitution I) — edit teaching content
 * without touching engine or scene code.
 *
 * Marker syntax: [[id:display text]] — id must exist in ALL_HIGHLIGHT_IDS.
 */

export const CHAPTER_TITLES = [
  'Chapter 1 · Welcome to the building',
  'Chapter 2 · The Worker and the desk',
  'Chapter 3 · Fetch — the next card',
  'Chapter 4 · Decode — reading the card',
  'Chapter 5 · Execute — the happy path',
  'Chapter 6 · The miss cascade',
  'Chapter 7 · The trip to the warehouse',
  'Chapter 8 · The big picture',
  'Chapter 9 · Pipelining — the assembly line',
] as const;

export const NARRATION: string[][] = [
  // ---- Chapter 1 · Welcome ----
  [
    'This tower is a processor. Everything a CPU does — every game frame, every line of code — happens somewhere in this building. Let me show you around.',
    'The top floor is where the actual thinking happens. Up there sits [[worker:the Worker]] — our stand-in for the CPU core, the part that computes. Everything else in this building exists to keep that one person busy.',
    'One floor down, floor 9, are two small shelves: the [[l1i:L1 instruction cache]] and the [[l1d:L1 data cache]]. Floor 8 holds a bigger storeroom, the [[l2:L2 cache]]. Small, close, fast — remember that trade.',
    'Way down on floor 4 is a vast archive: [[ram:RAM]], the main memory. It holds millions of times more than the shelves upstairs — but look how far down it is. And across the street? That warehouse is the [[disk:disk]]. We will visit it later. Sadly.',
  ],
  // ---- Chapter 2 · The Worker's job ----
  [
    'Meet [[worker:the Worker]]. Their whole job is a loop: get an instruction, figure out what it says, do it. Billions of times per second. That loop is called fetch–decode–execute, and it is the heartbeat of every processor.',
    'The desk drawers are the [[registers:registers]] — a handful of tiny boxes within arm\'s reach. Zero travel time. Whatever the Worker is using right now lives in a drawer. There are only a few of them, and that scarcity shapes everything.',
    'The yellow machine is the [[pc:program counter]] — a ticket dispenser that always knows which instruction comes next. A program is just a long stack of instruction cards, stored down in the [[ram:archive]] like everything else.',
  ],
  // ---- Chapter 3 · Fetch ----
  [
    'The [[pc:program counter]] pops a ticket: "next up — card number 4,096". The Worker needs that instruction card in hand before anything can happen. This is the fetch.',
    'Here is the clever part: the building staff already sent a whole batch of upcoming cards up to the [[l1i:instruction shelf]] one floor below — because programs almost always run cards in order. Fetching from the shelf beats a trip to the archive every time.',
    'Watch the card arrive: one floor in the [[lift:lift]], a few nanoseconds, done. The Worker barely looks up. When the guess is right — and it usually is — fetch is nearly free.',
  ],
  // ---- Chapter 4 · Decode ----
  [
    'Card in hand, the Worker reads it: "ADD the value in drawer [[registers:R1]] to the value at address 0x2F40". But a card is just a pattern of bits — decode is the step where bits become a plan.',
    'The card splits into two questions: WHAT to do (add two numbers — easy, the Worker is great at math) and WHERE the data is (drawer R1 is right here… but address 0x2F40 is somewhere out in memory). That second question is about to matter a lot.',
  ],
  // ---- Chapter 5 · Execute — the happy path ----
  [
    'Address 0x2F40 — where is it? Rule number one: always check the closest shelf first. The Worker asks the [[l1d:L1 data shelf]], one floor down… and it is THERE. A cache hit. The best thing that can happen to a CPU.',
    'One quick [[lift:lift]] hop and the value lands on the desk — about 4 cycles, door to door. The Worker adds the numbers without even standing up. This is the happy path: compute at full speed because the data was close.',
    'The result goes into drawer [[registers:R1]]. Fetch, decode, execute — one instruction done, on to the next. When every access hits like this, the whole tower hums.',
  ],
  // ---- Chapter 6 · The miss cascade ----
  [
    'Next card: "LOAD the value at address 0x8A00". The Worker checks the [[l1d:L1 shelf]]… not there. A cache miss. No drama yet — there is a bigger storeroom one floor further down.',
    'The [[l2:L2 storeroom]] holds far more than the shelf… but the answer comes back: not here either. Two misses in a row. Now the only option is the long ride down to the archive.',
    'Down, down, down to floor 4. Watch the Worker up there — foot tapping, doing absolutely nothing. This is the dirty secret of computing: a fast core spends a shocking amount of its life just WAITING for data.',
    'Feel the difference: [[registers:drawer]] ≈ 0 cycles. [[l1d:L1]] ≈ 4. [[l2:L2]] ≈ 12. [[ram:RAM]] ≈ 200. That is fifty times slower than the shelf — and we still got lucky. It could have been worse. Much worse.',
  ],
  // ---- Chapter 7 · The disk trip ----
  [
    'The worst case: the data is not in the tower at all. It lives across the street, in the [[disk:warehouse]] — on disk. Nothing moves between buildings except the [[courier:courier van]].',
    'So we wait. And wait. …Millions of cycles later, the van finally rolls back in. In the time this one trip took, the Worker could have run entire programs. Instead: foot-tapping.',
    'THIS is why the caches exist. You cannot make the warehouse closer — but you can keep the stuff you use most often on the shelf next to you. Every level of this building is a bet that the recent past predicts the near future. The bet is called locality, and it pays off constantly.',
  ],
  // ---- Chapter 8 · The big picture ----
  [
    'Step back and look at the whole ladder: [[registers:drawers]] on the desk, [[l1d:L1]] one floor down, [[l2:L2]] below that, [[ram:the archive]] far below, and the [[disk:warehouse]] across the street. Every level: bigger, but slower. Smaller, but faster. Pick two.',
    'The full price list, side by side. Notice the scale — that last line is not a typo. Every trick in computer architecture — caches, prefetching, out-of-order execution — exists to keep the Worker from ever paying it.',
    'Now it is your turn. The launcher below lets YOU fire instructions at the building and watch where the data comes from — and what it costs. See if you can keep the Worker busy. The building is yours.',
  ],
  // ---- Chapter 9 · Pipelining ----
  [
    'One last idea before the building is yours. So far [[worker:the Worker]] has handled every card start to finish — fetch it, decode it, execute it — and only then touched the next one. Three cards means nine steps, one after another, and while the Worker decodes, nobody is fetching and nobody is executing. That is slow. There is a better way.',
    'So the building hires two clerks. One stands by the lift and only fetches. One stands beside them and only decodes. The Worker keeps the last job: executing. Together they form an [[pipeline:assembly line]] — each person does a single step, and a card moves down the belt from one station to the next.',
    'Now watch the line fill. While the Worker executes the first card, a clerk is decoding the second and another is already fetching the third. Three stations, three cards, everyone busy at once. Check the board: the line finishes four cards in six ticks — one at a time would take twelve. Nobody got faster. More of the building is simply working at the same moment.',
    'But a line has a weakness. Here the second card says: use the answer from the card just ahead of me — the new value for drawer [[registers:R1]]. That answer is not ready until the Worker finishes. So the clerk has to wait. A gap — a bubble — slides down the line, and every card behind it holds its place until the answer is written back. One dependency, one stall.',
    'Now the worst case: the card ahead needs data from memory. If it sits on the [[l1d:L1 shelf]], the wait is short. But on a miss, the Worker is stuck until the data arrives from the [[ram:archive]] — about 200 cycles — and the whole line freezes behind that one card. This is why caches matter even more in a pipeline: one slow memory trip stalls everyone.',
  ],
];

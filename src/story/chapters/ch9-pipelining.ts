import { buildSchedule, type PipelineInstruction } from '../../scene/pipelineSchedule';
import { TIMING } from '../../scene/timing';
import { makeChapter, seq, together } from './helpers';

/**
 * The cards the line works on. They are story content (what the chapter wants to show); the schedule — ticks,
 * bubbles, stalls — is computed by the pure `buildSchedule`, and the scene only plays it.
 * Exported so a test can check that the numbers the narration quotes ("six ticks … twelve") stay true.
 */
export const PIPELINE_PROGRAMS = {
  /** Four independent cards: the line fills and runs at full speed. */
  fill: [{ name: 'ADD' }, { name: 'SUB' }, { name: 'AND' }, { name: 'MOV' }] satisfies PipelineInstruction[],
  /** The second card needs the first one's answer: a bubble. */
  hazard: [
    { name: 'MUL r1', produces: 'r1' },
    { name: 'ADD r1', needs: 'r1' },
    { name: 'SUB r2' },
    { name: 'MOV r3' },
  ] satisfies PipelineInstruction[],
  /** One card has to wait for memory: the whole line holds behind it. */
  memory: [
    { name: 'ADD r1' },
    { name: 'LOAD r2', execTicks: TIMING.pipelineStallShown, produces: 'r2' },
    { name: 'SUB r3' },
    { name: 'MOV r4' },
  ] satisfies PipelineInstruction[],
};

/** Chapter 9 — pipelining: an assembly line, then the hazards that stall it. */
export default makeChapter(9, [
  {
    // Baseline: the Worker alone, one card at a time (fetch + decode, then execute, three times).
    cue: (v) =>
      seq(
        v.flyTo('floor10-desk'),
        v.workerWork('read-card'),
        v.workerWork('compute'),
        v.workerWork('read-card'),
        v.workerWork('compute'),
        v.workerWork('read-card'),
        v.workerWork('compute'),
      ),
  },
  { cue: (v) => together(v.flyTo('pipeline-line'), v.pipelineSetup()) },
  {
    cue: (v) => together(v.pipelineRun(buildSchedule(PIPELINE_PROGRAMS.fill)), v.workerWork('compute')),
  },
  { cue: (v) => v.pipelineRun(buildSchedule(PIPELINE_PROGRAMS.hazard)) },
  {
    cue: (v) => together(v.pipelineRun(buildSchedule(PIPELINE_PROGRAMS.memory)), v.workerWork('foot-tap')),
    timing: ['registers', 'l1d', 'ram'],
  },
]);

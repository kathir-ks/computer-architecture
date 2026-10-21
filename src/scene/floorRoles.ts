/** What each of the ten floors is for. Shown as labels in X-ray; floors without a memory level are "spare". */

export interface FloorRole {
  floor: number;
  role: string;
}

const SPARE = 'Spare floor';

/** Top floor first, the way the tower reads. */
export const FLOOR_ROLES: readonly FloorRole[] = [
  { floor: 10, role: 'Worker + registers' },
  { floor: 9, role: 'L1 · instruction & data shelves' },
  { floor: 8, role: 'L2 · storeroom' },
  { floor: 7, role: SPARE },
  { floor: 6, role: SPARE },
  { floor: 5, role: SPARE },
  { floor: 4, role: 'RAM · archive' },
  { floor: 3, role: SPARE },
  { floor: 2, role: SPARE },
  { floor: 1, role: 'Lobby · lift & street' },
];

export function isSpareFloor(floor: number): boolean {
  return FLOOR_ROLES.find((r) => r.floor === floor)?.role === SPARE;
}

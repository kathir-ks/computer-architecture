export type VantageId =
  | 'street'
  | 'building-front'
  | 'floor10-desk'
  | 'floor9-shelves'
  | 'floor8-storeroom'
  | 'floor4-archive'
  | 'warehouse'
  | 'lift-shaft'
  | 'recap-wide';

export interface Shot {
  pos: [number, number, number];
  target: [number, number, number];
}

/** Every named camera position the story may ask for. All sit on the open (+z) side of the tower. */
export const SHOTS: Record<VantageId, Shot> = {
  street: { pos: [6, 3, 44], target: [0, 10, 0] },
  'building-front': { pos: [20, 18, 32], target: [0, 14, 0] },
  'floor10-desk': { pos: [9, 31, 11], target: [3.2, 28.8, 0] },
  'floor9-shelves': { pos: [5, 27.5, 13], target: [0.2, 25.5, 0] },
  'floor8-storeroom': { pos: [6, 24.5, 13], target: [0.5, 22.5, 0] },
  'floor4-archive': { pos: [6, 12.5, 14], target: [0.5, 10.5, 0] },
  warehouse: { pos: [-16, 9, 26], target: [-26, 2.5, 8] },
  'lift-shaft': { pos: [-16, 17, 18], target: [-5.4, 15, 0] },
  'recap-wide': { pos: [26, 22, 42], target: [-8, 12, 0] },
};

export const BASE_FOV = 50;

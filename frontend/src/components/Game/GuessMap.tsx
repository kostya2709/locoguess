/**
 * Re-export GameMap as GuessMap for backward compatibility.
 * The actual implementation is in components/Map/.
 */

export { GameMap as GuessMap } from '../Map/GameMap';
export type { DraftMarker } from '../Map/types';

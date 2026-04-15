import type { GuessResult } from '../../types/game';

export interface DraftMarker {
  player_id: string;
  nickname: string;
  is_captain: boolean;
  lat: number;
  lng: number;
}

export interface RevealData {
  correct: { lat: number; lng: number; name: string | null };
  guesses: GuessResult[];
}

/** Shared props for all map provider implementations. */
export interface GameMapProps {
  guessPosition: [number, number] | null;
  onPositionChange?: (pos: [number, number]) => void;
  revealData: RevealData | null;
  teamColor?: string;
  teamDrafts?: DraftMarker[];
  currentPlayerId?: string;
  currentPlayerNickname?: string;
  isCaptain?: boolean;
  streetViewEnabled?: boolean;
}

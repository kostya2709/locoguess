/** Shared TypeScript types matching the backend schemas. */

export type GameStatus = 'lobby' | 'playing' | 'finished';
export type RoundStatus = 'pending' | 'guessing' | 'revealing' | 'complete';

export interface Game {
  id: string;
  join_code: string;
  name: string;
  status: GameStatus;
  round_duration: number;
  street_view_enabled: boolean;
  music_host: boolean;
  music_guests: boolean;
  current_round: number | null;
  total_rounds: number;
}

export interface Player {
  id: string;
  nickname: string;
  is_captain: boolean;
  session_id: string;
  team_id: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  players: Player[];
}

export interface RoundInfo {
  round_number: number;
  photo_url: string;
  location_name: string | null;
  status: RoundStatus;
}

export interface GuessResult {
  team_id: string;
  team_name: string;
  team_color: string;
  lat: number;
  lng: number;
  distance_km: number;
  score: number;
}

export interface ScoreboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  team_color: string;
  total_score: number;
  round_scores: (number | null)[];
}

/** WebSocket message types from server. */
export interface WsRoundStart {
  type: 'round_start';
  data: {
    round_number: number;
    photo_url: string;
    photo_urls?: string[];
    music_url?: string;
    music_host?: boolean;
    music_guests?: boolean;
    duration: number;
    total_rounds: number;
  };
}

export interface WsTimerTick {
  type: 'timer_tick';
  data: { seconds_remaining: number; paused?: boolean };
}

export interface WsTeamGuessed {
  type: 'team_guessed';
  data: { team_id: string; team_name: string };
}

export interface WsRoundReveal {
  type: 'round_reveal';
  data: {
    round_number: number;
    correct: { lat: number; lng: number; name: string | null };
    guesses: GuessResult[];
  };
}

export interface WsGameEnd {
  type: 'game_end';
  data: { scoreboard: ScoreboardEntry[] };
}

export interface WsPlayerJoined {
  type: 'player_joined';
  data: { team_id: string; nickname: string };
}

export interface WsGameState {
  type: 'game_state';
  data: { status: GameStatus; teams: Team[] };
}

export type WsMessage =
  | WsRoundStart
  | WsTimerTick
  | WsTeamGuessed
  | WsRoundReveal
  | WsGameEnd
  | WsPlayerJoined
  | WsGameState
  | { type: 'game_cancelled' }
  | { type: 'photo_change'; data: { index: number; photo_url?: string } }
  | { type: 'pong' };

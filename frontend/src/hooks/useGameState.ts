import { useReducer, useCallback } from 'react';
import type {
  GameStatus,
  GuessResult,
  ScoreboardEntry,
  Team,
  WsMessage,
} from '../types/game';

export interface GameState {
  status: GameStatus;
  teams: Team[];
  currentRound: number | null;
  totalRounds: number;
  photoUrl: string | null;
  photoUrls: string[];
  photoIndex: number;
  musicUrl: string | null;
  musicHost: boolean;
  musicGuests: boolean;
  secondsRemaining: number;
  timerPaused: boolean;
  guessedTeamIds: Set<string>;
  revealData: {
    correct: { lat: number; lng: number; name: string | null };
    guesses: GuessResult[];
  } | null;
  scoreboard: ScoreboardEntry[] | null;
}

const initialState: GameState = {
  status: 'lobby',
  teams: [],
  currentRound: null,
  totalRounds: 0,
  photoUrl: null,
  photoUrls: [],
  photoIndex: 0,
  musicUrl: null,
  musicHost: true,
  musicGuests: false,
  secondsRemaining: 0,
  timerPaused: false,
  guessedTeamIds: new Set(),
  revealData: null,
  scoreboard: null,
};

type Action = WsMessage | { type: 'set_teams'; teams: Team[] } | { type: 'set_status'; status: GameStatus } | { type: 'set_photo_index'; index: number };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'round_start': {
      const urls = action.data.photo_urls || [action.data.photo_url];
      return {
        ...state,
        status: 'playing',
        currentRound: action.data.round_number,
        totalRounds: action.data.total_rounds,
        photoUrl: urls[0],
        photoUrls: urls,
        photoIndex: 0,
        musicUrl: action.data.music_url || null,
        musicHost: action.data.music_host ?? true,
        musicGuests: action.data.music_guests ?? false,
        secondsRemaining: action.data.duration,
        guessedTeamIds: new Set(),
        revealData: null,
      };
    }

    case 'timer_tick':
      return {
        ...state,
        secondsRemaining: action.data.seconds_remaining,
        timerPaused: action.data.paused ?? false,
      };

    case 'team_guessed':
      return {
        ...state,
        guessedTeamIds: new Set([...state.guessedTeamIds, action.data.team_id]),
      };

    case 'round_reveal':
      return {
        ...state,
        secondsRemaining: 0,
        revealData: {
          correct: action.data.correct,
          guesses: action.data.guesses,
        },
      };

    case 'game_end':
      return {
        ...state,
        status: 'finished',
        scoreboard: action.data.scoreboard,
      };

    case 'player_joined':
      return state; // Teams will be refreshed via REST

    case 'photo_change':
      return {
        ...state,
        photoIndex: action.data.index,
        photoUrl: action.data.photo_url || state.photoUrls[action.data.index] || state.photoUrl,
      };

    case 'game_state':
      return {
        ...state,
        status: action.data.status,
        teams: action.data.teams,
      };

    case 'set_teams':
      return { ...state, teams: action.teams };

    case 'set_status':
      return { ...state, status: action.status };

    case 'set_photo_index':
      return {
        ...state,
        photoIndex: action.index,
        photoUrl: state.photoUrls[action.index] || state.photoUrl,
      };

    case 'pong':
      return state;

    default:
      return state;
  }
}

/**
 * Manages the client-side game state, driven by WebSocket messages.
 * Returns the current state and a dispatch function for WS messages.
 */
export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleMessage = useCallback((msg: WsMessage) => {
    dispatch(msg);
  }, []);

  return { state, dispatch, handleMessage };
}

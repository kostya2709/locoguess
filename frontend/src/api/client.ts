/** REST API client for the LocoGuess backend. */

const BASE = '/api/v1';

/** Single room code — no multi-room support for now. */
export const GAME_CODE = 'GAME01';

const ADMIN_TOKEN_KEY = 'locoguess_admin_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  const token = getAdminToken();
  if (token) headers['X-Admin-Token'] = token;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    // If an admin-gated endpoint returns 401, our stored token is stale.
    if (res.status === 401) clearAdminToken();
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

import type { Game, Team, Player, RoundInfo, GuessResult, ScoreboardEntry } from '../types/game';

export interface GameCreateResponse extends Game {
  host_secret: string;
}

export interface PackInfo {
  id: string;
  name: string;
  description: string;
  round_count: number;
}

export interface PlayerStatusInfo {
  id: string;
  nickname: string;
  is_captain: boolean;
}

export interface TeamStatusInfo {
  id: string;
  name: string;
  color: string;
  player_count: number;
  players: PlayerStatusInfo[];
}

export interface GameStatusResponse {
  id: string;
  join_code: string;
  name: string;
  status: string;
  round_duration: number;
  street_view_enabled: boolean;
  music_host: boolean;
  music_guests: boolean;
  total_rounds: number;
  rounds_configured: number;
  teams: TeamStatusInfo[];
  ready_to_start: boolean;
}

export interface ClaimHostResponse {
  is_host: boolean;
  rounds_configured: number;
}

export interface PackRoundInfo {
  id: string;
  round_number: number;
  photo_path: string;
  photo_urls: string[];
  correct_lat: number;
  correct_lng: number;
  location_name: string | null;
  music_url: string | null;
}

export interface PackDetail {
  id: string;
  name: string;
  description: string;
  rounds: PackRoundInfo[];
}

export const api = {
  // Admin-password verification. Returns a session token to include as
  // X-Admin-Token on subsequent admin calls. Called before navigating to
  // /host or /marketplace.
  verifyAdmin(password: string) {
    return request<{ token: string }>('/admin/verify', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  // Pack CRUD
  getPacks() {
    return request<PackInfo[]>('/packs');
  },

  getPack(packId: string) {
    return request<PackDetail>(`/packs/${packId}`);
  },

  createPack(name: string, description: string) {
    return request<PackDetail>('/packs', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  updatePack(packId: string, opts: { name?: string; description?: string }) {
    return request<PackDetail>(`/packs/${packId}`, {
      method: 'PATCH',
      body: JSON.stringify(opts),
    });
  },

  deletePack(packId: string) {
    return fetch(`${BASE}/packs/${packId}`, { method: 'DELETE' });
  },

  addPackRound(packId: string, photoPath: string, lat: number, lng: number, locationName?: string, musicPath?: string) {
    return request<PackRoundInfo>(`/packs/${packId}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ photo_path: photoPath, correct_lat: lat, correct_lng: lng, location_name: locationName, music_path: musicPath }),
    });
  },

  updatePackRound(packId: string, roundId: string, opts: { photo_path?: string; correct_lat?: number; correct_lng?: number; location_name?: string }) {
    return request<PackRoundInfo>(`/packs/${packId}/rounds/${roundId}`, {
      method: 'PATCH',
      body: JSON.stringify(opts),
    });
  },

  movePackRound(packId: string, roundId: string, direction: 'up' | 'down') {
    return request<{ ok: boolean }>(`/packs/${packId}/rounds/${roundId}/move`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    });
  },

  deletePackRound(packId: string, roundId: string) {
    return fetch(`${BASE}/packs/${packId}/rounds/${roundId}`, { method: 'DELETE' });
  },

  async uploadPackMusic(packId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/packs/${packId}/rounds/upload-music`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.filename;
  },

  async uploadPackPhoto(packId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/packs/${packId}/rounds/upload-photo`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.filename;
  },

  // Game endpoints

  createGame(opts: {
    name?: string;
    pack_id?: string;
    team_count: number;
    team_names?: string[];
    round_duration: number;
    total_rounds?: number;
  }) {
    return request<GameCreateResponse>('/games', {
      method: 'POST',
      body: JSON.stringify(opts),
    });
  },

  getGame(joinCode: string) {
    return request<Game>(`/games/${joinCode}`);
  },

  updateGame(joinCode: string, opts: { team_count?: number; team_names?: string[]; round_duration?: number; street_view_enabled?: boolean; music_host?: boolean; music_guests?: boolean }) {
    return request<Game>(`/games/${joinCode}`, {
      method: 'PATCH',
      body: JSON.stringify(opts),
    });
  },

  getGameStatus(joinCode: string) {
    return request<GameStatusResponse>(`/games/${joinCode}/status`);
  },

  claimHost(joinCode: string, hostSecret: string) {
    return request<ClaimHostResponse>(`/games/${joinCode}/claim-host`, {
      method: 'POST',
      body: JSON.stringify({ host_secret: hostSecret }),
    });
  },

  getTeams(joinCode: string) {
    return request<Team[]>(`/games/${joinCode}/teams`);
  },

  joinTeam(joinCode: string, teamId: string, nickname: string, sessionId?: string) {
    return request<Player>(`/games/${joinCode}/teams/${teamId}/join`, {
      method: 'POST',
      body: JSON.stringify({ nickname, session_id: sessionId }),
    });
  },

  switchTeam(joinCode: string, newTeamId: string, sessionId: string) {
    return request<import('../types/game').Player>(`/games/${joinCode}/teams/${newTeamId}/switch`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  renamePlayer(joinCode: string, sessionId: string, nickname: string) {
    return request<import('../types/game').Player>(`/games/${joinCode}/teams/rename`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, nickname }),
    });
  },

  setCaptain(joinCode: string, teamId: string, playerId: string) {
    return request<import('../types/game').Player>(`/games/${joinCode}/teams/${teamId}/captain/${playerId}`, {
      method: 'POST',
    });
  },

  startGame(joinCode: string) {
    return request<Game>(`/games/${joinCode}/start`, { method: 'POST' });
  },

  nextRound(joinCode: string) {
    return request<Game>(`/games/${joinCode}/next-round`, { method: 'POST' });
  },

  endGame(joinCode: string) {
    return request<Game>(`/games/${joinCode}/end-game`, { method: 'POST' });
  },

  setPhotoIndex(joinCode: string, index: number) {
    return request<{ ok: boolean }>(`/games/${joinCode}/set-photo`, {
      method: 'POST',
      body: JSON.stringify({ index }),
    });
  },

  pauseTimer(joinCode: string) {
    return request<{ ok: boolean }>(`/games/${joinCode}/timer/pause`, { method: 'POST' });
  },

  resumeTimer(joinCode: string) {
    return request<{ ok: boolean }>(`/games/${joinCode}/timer/resume`, { method: 'POST' });
  },

  resetTimer(joinCode: string) {
    return request<{ ok: boolean }>(`/games/${joinCode}/timer/reset`, { method: 'POST' });
  },

  replayRound(joinCode: string) {
    return request<Game>(`/games/${joinCode}/replay-round`, { method: 'POST' });
  },

  replayGame(joinCode: string) {
    return request<Game>(`/games/${joinCode}/replay-game`, { method: 'POST' });
  },

  getRound(joinCode: string, roundNumber: number) {
    return request<{ round_number: number; photo_url: string; photo_urls?: string[]; music_url?: string; location_name: string | null; status: string }>(
      `/games/${joinCode}/rounds/${roundNumber}`
    );
  },

  getRoundResults(joinCode: string, roundNumber: number) {
    return request<{
      round_number: number;
      correct: { lat: number; lng: number; name: string | null };
      guesses: Array<{
        team_id: string; team_name: string; team_color: string;
        lat: number; lng: number; distance_km: number; score: number;
      }>;
    }>(`/games/${joinCode}/rounds/${roundNumber}/results`);
  },

  async uploadPhoto(joinCode: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/games/${joinCode}/rounds/upload-photo`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.filename;
  },

  addRound(joinCode: string, photoPath: string, lat: number, lng: number, locationName?: string) {
    return request<RoundInfo>(`/games/${joinCode}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        photo_path: photoPath,
        correct_lat: lat,
        correct_lng: lng,
        location_name: locationName,
      }),
    });
  },

  submitGuess(joinCode: string, roundNumber: number, lat: number, lng: number, sessionId: string) {
    return request<GuessResult>(`/games/${joinCode}/rounds/${roundNumber}/guess`, {
      method: 'POST',
      body: JSON.stringify({ lat, lng, session_id: sessionId }),
    });
  },

  postDraft(joinCode: string, roundNumber: number, lat: number, lng: number, sessionId: string) {
    return request<{ ok: boolean }>(`/games/${joinCode}/rounds/${roundNumber}/draft`, {
      method: 'POST',
      body: JSON.stringify({ lat, lng, session_id: sessionId }),
    });
  },

  getDrafts(joinCode: string, roundNumber: number, sessionId: string) {
    return request<Array<{
      player_id: string;
      nickname: string;
      is_captain: boolean;
      lat: number;
      lng: number;
    }>>(`/games/${joinCode}/rounds/${roundNumber}/drafts?session_id=${sessionId}`);
  },

  getScoreboard(joinCode: string) {
    return request<ScoreboardEntry[]>(`/games/${joinCode}/scoreboard`);
  },
};

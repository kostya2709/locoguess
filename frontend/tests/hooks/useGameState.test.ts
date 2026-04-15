import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from '../../src/hooks/useGameState';

describe('useGameState', () => {
  it('starts with lobby status', () => {
    const { result } = renderHook(() => useGameState());
    expect(result.current.state.status).toBe('lobby');
    expect(result.current.state.currentRound).toBeNull();
  });

  it('handles round_start message', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.handleMessage({
        type: 'round_start',
        data: {
          round_number: 0,
          photo_url: '/photos/paris.jpg',
          duration: 60,
          total_rounds: 3,
        },
      });
    });
    expect(result.current.state.status).toBe('playing');
    expect(result.current.state.currentRound).toBe(0);
    expect(result.current.state.photoUrl).toBe('/photos/paris.jpg');
    expect(result.current.state.secondsRemaining).toBe(60);
    expect(result.current.state.totalRounds).toBe(3);
  });

  it('handles timer_tick message', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.handleMessage({
        type: 'timer_tick',
        data: { seconds_remaining: 42 },
      });
    });
    expect(result.current.state.secondsRemaining).toBe(42);
  });

  it('handles team_guessed message', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.handleMessage({
        type: 'team_guessed',
        data: { team_id: 'team1', team_name: 'Alpha' },
      });
    });
    expect(result.current.state.guessedTeamIds.has('team1')).toBe(true);
  });

  it('handles round_reveal message', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.handleMessage({
        type: 'round_reveal',
        data: {
          round_number: 0,
          correct: { lat: 48.85, lng: 2.35, name: 'Paris' },
          guesses: [
            {
              team_id: 't1',
              team_name: 'A',
              team_color: '#ff0000',
              lat: 49,
              lng: 2.5,
              distance_km: 18.3,
              score: 4955,
            },
          ],
        },
      });
    });
    expect(result.current.state.revealData).not.toBeNull();
    expect(result.current.state.revealData!.correct.name).toBe('Paris');
    expect(result.current.state.secondsRemaining).toBe(0);
  });

  it('handles game_end message', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.handleMessage({
        type: 'game_end',
        data: {
          scoreboard: [
            {
              rank: 1,
              team_id: 't1',
              team_name: 'Alpha',
              team_color: '#ff0000',
              total_score: 15000,
              round_scores: [5000, 5000, 5000],
            },
          ],
        },
      });
    });
    expect(result.current.state.status).toBe('finished');
    expect(result.current.state.scoreboard).toHaveLength(1);
  });

  it('clears reveal data on new round', () => {
    const { result } = renderHook(() => useGameState());
    // First set reveal data
    act(() => {
      result.current.handleMessage({
        type: 'round_reveal',
        data: {
          round_number: 0,
          correct: { lat: 0, lng: 0, name: null },
          guesses: [],
        },
      });
    });
    expect(result.current.state.revealData).not.toBeNull();

    // Then start new round
    act(() => {
      result.current.handleMessage({
        type: 'round_start',
        data: { round_number: 1, photo_url: '/photos/x.jpg', duration: 60, total_rounds: 3 },
      });
    });
    expect(result.current.state.revealData).toBeNull();
    expect(result.current.state.guessedTeamIds.size).toBe(0);
  });
});

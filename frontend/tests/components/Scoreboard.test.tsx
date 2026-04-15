import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Scoreboard } from '../../src/components/Results/Scoreboard';
import type { ScoreboardEntry } from '../../src/types/game';

const entries: ScoreboardEntry[] = [
  {
    rank: 1,
    team_id: 't1',
    team_name: 'Alpha',
    team_color: '#ff0000',
    total_score: 12000,
    round_scores: [5000, 4000, 3000],
  },
  {
    rank: 2,
    team_id: 't2',
    team_name: 'Beta',
    team_color: '#0000ff',
    total_score: 8000,
    round_scores: [3000, 2000, 3000],
  },
];

describe('Scoreboard', () => {
  it('renders team names', () => {
    render(<Scoreboard entries={entries} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders total scores', () => {
    render(<Scoreboard entries={entries} />);
    expect(screen.getByText('12000')).toBeInTheDocument();
    expect(screen.getByText('8000')).toBeInTheDocument();
  });

  it('renders round headers', () => {
    render(<Scoreboard entries={entries} />);
    expect(screen.getByText('Р1')).toBeInTheDocument();
    expect(screen.getByText('Р2')).toBeInTheDocument();
    expect(screen.getByText('Р3')).toBeInTheDocument();
  });

  it('shows loading when empty', () => {
    render(<Scoreboard entries={[]} />);
    expect(screen.getByText('Загрузка результатов...')).toBeInTheDocument();
  });
});

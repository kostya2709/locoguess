import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Timer } from '../../src/components/Game/Timer';

describe('Timer', () => {
  it('formats time correctly', () => {
    render(<Timer seconds={125} />);
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('shows 0:00 when expired', () => {
    render(<Timer seconds={0} />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('adds urgent class when under 10 seconds', () => {
    const { container } = render(<Timer seconds={5} />);
    expect(container.querySelector('.timer-urgent')).not.toBeNull();
  });

  it('does not add urgent class when over 10 seconds', () => {
    const { container } = render(<Timer seconds={30} />);
    expect(container.querySelector('.timer-urgent')).toBeNull();
  });

  it('does not add urgent class at 0 seconds', () => {
    const { container } = render(<Timer seconds={0} />);
    expect(container.querySelector('.timer-urgent')).toBeNull();
  });
});

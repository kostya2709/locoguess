interface Props {
  seconds: number;
  paused?: boolean;
}

/** Countdown timer display. Turns red when under 10 seconds. Blinks when paused. */
export function Timer({ seconds, paused }: Props) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isUrgent = seconds > 0 && seconds <= 10;

  return (
    <div className={`timer ${isUrgent ? 'timer-urgent' : ''} ${paused ? 'timer-paused' : ''}`}>
      {paused && '⏸ '}
      {minutes}:{secs.toString().padStart(2, '0')}
    </div>
  );
}

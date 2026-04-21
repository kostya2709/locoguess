import { useEffect, useRef, useState, useCallback } from 'react';

interface Options {
  musicUrl: string | null;
  shouldPlay: boolean;
  paused: boolean;
  isRevealing: boolean;
}

/**
 * Manages audio playback for the current round.
 * Handles browser autoplay restrictions with a manual play trigger.
 */
export function useRoundMusic({ musicUrl, shouldPlay, paused, isRevealing }: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blocked, setBlocked] = useState(false);

  // Swap audio element when the URL changes.
  useEffect(() => {
    if (!musicUrl || !shouldPlay) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setBlocked(false);
      return;
    }

    const audio = new Audio(musicUrl);
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [musicUrl, shouldPlay]);

  // Play / pause in response to state, including right after a swap.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (paused || isRevealing || !shouldPlay) {
      audio.pause();
      return;
    }

    let cancelled = false;
    audio.play().then(
      () => { if (!cancelled) setBlocked(false); },
      (err) => {
        if (cancelled) return;
        // AbortError fires when our own cleanup interrupts a pending play;
        // that doesn't mean autoplay was blocked.
        if (err?.name === 'AbortError') return;
        setBlocked(true);
      },
    );
    return () => { cancelled = true; };
  }, [musicUrl, paused, isRevealing, shouldPlay]);

  const unblock = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => setBlocked(false)).catch(() => {});
  }, []);

  return { blocked, unblock };
}

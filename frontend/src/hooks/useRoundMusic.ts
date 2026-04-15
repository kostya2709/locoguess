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
  const wantPlayRef = useRef(false);

  // Track whether we WANT to be playing right now
  wantPlayRef.current = !!musicUrl && shouldPlay && !paused && !isRevealing;

  // Create audio element when URL changes
  useEffect(() => {
    // Cleanup old audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setBlocked(false);

    if (!musicUrl || !shouldPlay) return;

    const audio = new Audio(musicUrl);
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    // Try to play immediately
    if (wantPlayRef.current) {
      audio.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [musicUrl, shouldPlay]);

  // React to pause/resume/reveal changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (paused || isRevealing) {
      audio.pause();
    } else if (shouldPlay) {
      audio.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }
  }, [paused, isRevealing, shouldPlay]);

  // Manual unblock: called by clicking the 🔇 button
  const unblock = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => setBlocked(false)).catch(() => {});
  }, []);

  return { blocked, unblock };
}

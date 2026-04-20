import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import { useRoundMusic } from '../hooks/useRoundMusic';
import { useWebSocket } from '../hooks/useWebSocket';
import { PhotoDisplay } from '../components/Game/PhotoDisplay';
import { GuessMap } from '../components/Game/GuessMap';
import { Timer } from '../components/Game/Timer';
import { RoundResults } from '../components/Game/RoundResults';
import { api, GAME_CODE } from '../api/client';
import { Scoreboard } from '../components/Results/Scoreboard';
import type { Player, ScoreboardEntry } from '../types/game';

export function GamePage() {
  const navigate = useNavigate();
  const { state, dispatch, handleMessage } = useGameState();
  const [player, setPlayer] = useState<Player | null>(null);
  const [guessPosition, setGuessPosition] = useState<[number, number] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState<'photo' | 'map' | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [myTeam, setMyTeam] = useState<{ name: string; color: string } | null>(null);
  const [teamDrafts, setTeamDrafts] = useState<Array<{ player_id: string; nickname: string; is_captain: boolean; lat: number; lng: number }>>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [streetViewEnabled, setStreetViewEnabled] = useState(false);
  const lastFetchedRoundRef = useRef<string>('');
  const [browserFullscreen, setBrowserFullscreen] = useState(false);

  const isHost = !!localStorage.getItem(`locoguess_host_${GAME_CODE}`)
    && sessionStorage.getItem(`locoguess_role_${GAME_CODE}`) !== 'player';

  useEffect(() => {
    const sync = () => setBrowserFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  function toggleBrowserFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  // Restore player session and fetch team info
  useEffect(() => {
    const saved = sessionStorage.getItem(`locoguess_session_${GAME_CODE}`)
      || localStorage.getItem(`locoguess_session_${GAME_CODE}`);
    if (saved) {
      const p = JSON.parse(saved) as Player;
      setPlayer(p);
      api.getGameStatus(GAME_CODE).then((status) => {
        const team = status.teams.find((t) => t.id === p.team_id);
        if (team) setMyTeam({ name: team.name, color: team.color });
      }).catch(() => {});
    }
  }, []);

  // Close menu on Esc
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen((prev) => !prev);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  /** Fetch current game/round state via REST. */
  const fetchState = useCallback(async () => {
    try {
      const game = await api.getGame(GAME_CODE);
      setStreetViewEnabled(game.street_view_enabled);
      if (game.status === 'finished') {
        navigate('/results');
        return;
      }
      if (game.status === 'playing' && game.current_round !== null) {
        const round = await api.getRound(GAME_CODE, game.current_round);
        const roundKey = `${game.current_round}-${round.status}`;
        if (lastFetchedRoundRef.current !== roundKey) {
          lastFetchedRoundRef.current = roundKey;
          if (round.status === 'guessing') {
            dispatch({
              type: 'round_start',
              data: {
                round_number: game.current_round,
                photo_url: round.photo_url,
                photo_urls: round.photo_urls,
                music_url: round.music_url,
                music_host: game.music_host,
                music_guests: game.music_guests,
                duration: game.round_duration,
                total_rounds: game.total_rounds,
              },
            });
            setGuessPosition(null);
            setSubmitted(false);
          }
          if (round.status === 'complete' || round.status === 'revealing') {
            dispatch({
              type: 'round_start',
              data: {
                round_number: game.current_round,
                photo_url: round.photo_url,
                photo_urls: round.photo_urls,
                music_url: round.music_url,
                music_host: game.music_host,
                music_guests: game.music_guests,
                duration: game.round_duration,
                total_rounds: game.total_rounds,
              },
            });
            try {
              const results = await api.getRoundResults(GAME_CODE, game.current_round);
              dispatch({
                type: 'round_reveal',
                data: {
                  round_number: results.round_number,
                  correct: results.correct,
                  guesses: results.guesses,
                },
              });
            } catch { /* not available yet */ }
          }
        }
      }
    } catch { /* ignore */ }
  }, [navigate, dispatch]);

  useEffect(() => { fetchState(); }, [fetchState]);
  useEffect(() => {
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const onWsMessage = useCallback(
    (msg: Parameters<typeof handleMessage>[0]) => {
      handleMessage(msg);
      if (msg.type === 'round_start') {
        lastFetchedRoundRef.current = '';
        setGuessPosition(null);
        setSubmitted(false);
      }
      if (msg.type === 'round_reveal') {
        lastFetchedRoundRef.current = '';
      }
      if (msg.type === 'game_end') {
        navigate('/results');
      }
      if (msg.type === 'game_cancelled') {
        navigate('/join');
      }
    },
    [handleMessage, navigate],
  );

  useWebSocket({
    joinCode: GAME_CODE,
    sessionId: player?.session_id || (isHost ? `host-${GAME_CODE}` : 'spectator'),
    onMessage: onWsMessage,
  });

  // Draft markers
  function handlePositionChange(pos: [number, number]) {
    setGuessPosition(pos);
    if (player && state.currentRound !== null) {
      api.postDraft(GAME_CODE, state.currentRound, pos[0], pos[1], player.session_id).catch(() => {});
    }
  }

  useEffect(() => {
    if (!player || state.currentRound === null || submitted || state.revealData) {
      setTeamDrafts([]);
      return;
    }
    const poll = () => {
      api.getDrafts(GAME_CODE, state.currentRound!, player.session_id)
        .then(setTeamDrafts)
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [player, state.currentRound, submitted, state.revealData]);

  async function handleSubmitGuess() {
    if (!player || !guessPosition || state.currentRound === null) return;
    setError('');
    try {
      await api.submitGuess(GAME_CODE, state.currentRound, guessPosition[0], guessPosition[1], player.session_id);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить ответ');
    }
  }

  async function handleNextRound() {
    setError('');
    try {
      await api.nextRound(GAME_CODE);
      lastFetchedRoundRef.current = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось перейти к следующему раунду');
    }
  }

  // Menu actions (host only)
  async function menuAction(action: string) {
    setMenuOpen(false);
    setError('');
    try {
      switch (action) {
        case 'pause':
          await api.pauseTimer(GAME_CODE);
          break;
        case 'resume':
          await api.resumeTimer(GAME_CODE);
          break;
        case 'reset_timer':
          if (!window.confirm('Сбросить таймер?')) return;
          await api.resetTimer(GAME_CODE);
          break;
        case 'replay_round':
          if (!window.confirm('Переиграть текущий раунд? Ответы будут удалены.')) return;
          await api.replayRound(GAME_CODE);
          lastFetchedRoundRef.current = '';
          setSubmitted(false);
          setGuessPosition(null);
          break;
        case 'replay_game':
          if (!window.confirm('Переиграть всю игру с начала?')) return;
          await api.replayGame(GAME_CODE);
          lastFetchedRoundRef.current = '';
          setSubmitted(false);
          setGuessPosition(null);
          break;
        case 'end_game':
          if (!window.confirm('Завершить игру? Все будут перенаправлены на главную страницу.')) return;
          await api.endGame(GAME_CODE);
          navigate('/');
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  // Refresh scoreboard on reveal
  useEffect(() => {
    if (state.revealData) {
      api.getScoreboard(GAME_CODE).then(setScoreboard).catch(() => {});
    }
  }, [state.revealData]);

  const isRevealing = state.revealData !== null;

  // Music playback
  const shouldPlayMusic = state.musicUrl !== null && (
    (isHost && state.musicHost) || (!isHost && state.musicGuests)
  );
  const { blocked: musicBlocked, unblock: unblockMusic } = useRoundMusic({
    musicUrl: state.musicUrl,
    shouldPlay: shouldPlayMusic,
    paused: state.timerPaused,
    isRevealing,
  });
  const isLastRound = (state.currentRound ?? 0) + 1 >= state.totalRounds;

  return (
    <div className="game-page">
      <div className="game-header">
        <span>
          Раунд {(state.currentRound ?? 0) + 1} / {state.totalRounds}
        </span>
        {myTeam && player && (
          <span className="my-team-badge">
            <span className="team-dot" style={{ background: myTeam.color }} />
            {myTeam.name} &middot; {player.nickname}
            {player.is_captain && ' ★'}
          </span>
        )}
        {isHost && !myTeam && (
          <span className="my-team-badge host-badge-game">Ведущий</span>
        )}
        <Timer seconds={state.secondsRemaining} paused={state.timerPaused} />
        {musicBlocked && shouldPlayMusic && (
          <button className="music-unblock-btn" onClick={unblockMusic}
            title="Нажмите, чтобы включить музыку">
            🔇
          </button>
        )}
        <button
          className="menu-btn"
          onClick={toggleBrowserFullscreen}
          title={browserFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
        >
          {browserFullscreen ? '⤡' : '⛶'}
        </button>
        <button
          className="menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          title="Меню (Esc)"
        >
          ☰
        </button>
      </div>

      {/* Slide-out menu */}
      {menuOpen && (
        <div className="game-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="game-menu" onClick={(e) => e.stopPropagation()}>
            <h3>Меню</h3>
            {isHost && !isRevealing && (
              <>
                <button onClick={() => menuAction(state.timerPaused ? 'resume' : 'pause')}>
                  {state.timerPaused ? '▶ Продолжить таймер' : '⏸ Пауза'}
                </button>
                <button onClick={() => menuAction('reset_timer')}>
                  ⟳ Сбросить таймер
                </button>
              </>
            )}
            {isHost && (
              <>
                <button onClick={() => menuAction('replay_round')}>
                  ↺ Переиграть раунд
                </button>
                <button onClick={() => menuAction('replay_game')}>
                  ↻ Переиграть всю игру
                </button>
                <button className="menu-danger" onClick={() => menuAction('end_game')}>
                  ✕ Завершить игру
                </button>
              </>
            )}
            {!isHost && (
              <button onClick={() => { setMenuOpen(false); navigate('/'); }}>
                На главную страницу
              </button>
            )}
            <button className="menu-close" onClick={() => setMenuOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className={`game-content ${fullscreen ? 'fullscreen-active' : ''}`}>
        <div className={`photo-panel ${fullscreen === 'photo' ? 'panel-fullscreen' : ''} ${fullscreen === 'map' ? 'panel-hidden' : ''}`}>
          {state.photoUrl && <PhotoDisplay url={state.photoUrl} />}
          {isHost && state.photoUrls.length > 1 && (
            <div className="photo-nav">
              <button
                className="photo-nav-btn"
                disabled={state.photoIndex === 0}
                onClick={() => {
                  const idx = state.photoIndex - 1;
                  dispatch({ type: 'set_photo_index', index: idx });
                  if (isHost) api.setPhotoIndex(GAME_CODE, idx);
                }}
              >
                ‹
              </button>
              <span className="photo-counter">
                {state.photoIndex + 1} / {state.photoUrls.length}
              </span>
              <button
                className="photo-nav-btn"
                disabled={state.photoIndex >= state.photoUrls.length - 1}
                onClick={() => {
                  const idx = state.photoIndex + 1;
                  dispatch({ type: 'set_photo_index', index: idx });
                  if (isHost) api.setPhotoIndex(GAME_CODE, idx);
                }}
              >
                ›
              </button>
            </div>
          )}
          <button
            className="fullscreen-toggle"
            onClick={() => setFullscreen(fullscreen === 'photo' ? null : 'photo')}
            title={fullscreen === 'photo' ? 'Свернуть' : 'На весь экран'}
          >
            {fullscreen === 'photo' ? '✕' : '⛶'}
          </button>
        </div>
        <div className={`map-panel ${fullscreen === 'map' ? 'panel-fullscreen' : ''} ${fullscreen === 'photo' ? 'panel-hidden' : ''}`}>
          <GuessMap
            guessPosition={guessPosition}
            onPositionChange={player && !submitted && !isRevealing ? handlePositionChange : undefined}
            revealData={state.revealData}
            teamColor={myTeam?.color}
            teamDrafts={teamDrafts}
            currentPlayerId={player?.id}
            currentPlayerNickname={player?.nickname}
            isCaptain={player?.is_captain}
            streetViewEnabled={streetViewEnabled}
          />
          <button
            className="fullscreen-toggle map-fullscreen-toggle"
            onClick={() => setFullscreen(fullscreen === 'map' ? null : 'map')}
            title={fullscreen === 'map' ? 'Свернуть' : 'На весь экран'}
          >
            {fullscreen === 'map' ? '✕' : '⛶'}
          </button>
          {player?.is_captain && !submitted && !isRevealing && (
            <button
              className="submit-guess-btn"
              onClick={handleSubmitGuess}
              disabled={!guessPosition}
            >
              Зафиксировать ответ
            </button>
          )}
          {submitted && !isRevealing && (
            <div className="guess-submitted">Ответ принят! Ждём остальных...</div>
          )}
        </div>
      </div>

      {isRevealing && state.revealData && (
        <div className="reveal-section">
          <RoundResults data={state.revealData} />
          {isHost && (
            <button className="next-round-btn" onClick={handleNextRound}>
              {isLastRound ? 'Показать итоги' : 'Следующий раунд'}
            </button>
          )}
          {!isHost && (
            <div className="waiting-message">
              {isLastRound
                ? 'Ждём, пока ведущий покажет итоги...'
                : 'Ждём следующий раунд...'}
            </div>
          )}
        </div>
      )}
      <div className="scoreboard-toggle-section">
        <button
          className="scoreboard-toggle-btn"
          onClick={() => {
            if (!showScoreboard) {
              api.getScoreboard(GAME_CODE).then(setScoreboard).catch(() => {});
            }
            setShowScoreboard(!showScoreboard);
          }}
        >
          {showScoreboard ? 'Скрыть таблицу результатов ▲' : 'Таблица результатов ▼'}
        </button>
        {showScoreboard && <Scoreboard entries={scoreboard} />}
      </div>
    </div>
  );
}

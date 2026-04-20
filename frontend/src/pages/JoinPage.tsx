import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, GAME_CODE } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGameState } from '../hooks/useGameState';
import type { GameStatusResponse } from '../api/client';
import { BackButton } from '../components/common/BackButton';
import { getTabNickname } from '../App';
import type { Player } from '../types/game';

/**
 * Join page: see available teams, enter nickname, pick a team, wait for host to start.
 * Remembers nickname and team across games via localStorage.
 */
export function JoinPage() {
  const navigate = useNavigate();
  const [gameStatus, setGameStatus] = useState<GameStatusResponse | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [nickname] = useState(() => getTabNickname());
  const [error, setError] = useState('');
  const [noGame, setNoGame] = useState(false);
  const { handleMessage } = useGameState();

  useWebSocket({
    joinCode: player ? GAME_CODE : '',
    sessionId: player?.session_id || '',
    onMessage: useCallback(
      (msg: Parameters<typeof handleMessage>[0]) => {
        handleMessage(msg);
        if (msg.type === 'round_start') {
          navigate('/play');
        }
        if (msg.type === 'game_cancelled') {
          // Stay on join page — will re-poll for next game
          setPlayer(null);
          setNoGame(true);
        }
      },
      [handleMessage, navigate],
    ),
  });

  // Restore existing session for this tab (sessionStorage preferred, localStorage fallback for new tabs)
  useEffect(() => {
    const saved = sessionStorage.getItem(`locoguess_session_${GAME_CODE}`)
      || localStorage.getItem(`locoguess_session_${GAME_CODE}`);
    if (saved) {
      try {
        setPlayer(JSON.parse(saved) as Player);
      } catch {
        clearStoredSession();
      }
    }
  }, []);

  useEffect(() => {
    const poll = () =>
      api.getGameStatus(GAME_CODE)
        .then((s) => { setGameStatus(s); setNoGame(false); })
        .catch(() => setNoGame(true));
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // If the stored player no longer exists in the game (host wiped game, etc.), clear session
  useEffect(() => {
    if (!player || !gameStatus) return;
    const stillPresent = gameStatus.teams.some((t) => t.players.some((pl) => pl.id === player.id));
    if (!stillPresent) {
      clearStoredSession();
      setPlayer(null);
    }
  }, [player, gameStatus]);

  function persistSession(p: Player) {
    sessionStorage.setItem(`locoguess_session_${GAME_CODE}`, JSON.stringify(p));
    sessionStorage.setItem(`locoguess_role_${GAME_CODE}`, 'player');
    localStorage.setItem(`locoguess_session_${GAME_CODE}`, JSON.stringify(p));
  }

  function clearStoredSession() {
    sessionStorage.removeItem(`locoguess_session_${GAME_CODE}`);
    localStorage.removeItem(`locoguess_session_${GAME_CODE}`);
  }

  async function handleJoinTeam(teamId: string) {
    if (!nickname) {
      setError('Сначала введите имя');
      return;
    }
    setError('');
    try {
      const storedRaw = sessionStorage.getItem(`locoguess_session_${GAME_CODE}`)
        || localStorage.getItem(`locoguess_session_${GAME_CODE}`);
      let existingSid: string | undefined;
      if (storedRaw) {
        try { existingSid = (JSON.parse(storedRaw) as Player).session_id; } catch {}
      }
      const p = await api.joinTeam(GAME_CODE, teamId, nickname, existingSid);
      persistSession(p);
      // Fetch fresh status BEFORE setPlayer so the stale-session check doesn't
      // fire against a gameStatus that still predates this player.
      const status = await api.getGameStatus(GAME_CODE);
      setGameStatus(status);
      setPlayer(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось присоединиться');
    }
  }

  async function handleSwitchTeam(newTeamId: string) {
    if (!player) return;
    setError('');
    try {
      const updated = await api.switchTeam(GAME_CODE, newTeamId, player.session_id);
      persistSession(updated);
      const status = await api.getGameStatus(GAME_CODE);
      setGameStatus(status);
      setPlayer(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить команду');
    }
  }

  // If game is already playing, go straight to game
  useEffect(() => {
    if (gameStatus?.status === 'playing' && player) {
      navigate('/play');
    }
  }, [gameStatus, player, navigate]);

  if (noGame) {
    return (
      <div className="join-page">
        <BackButton to="/" />
        <h1>Присоединиться</h1>
        <div className="waiting-message">Игра ещё не создана. Ждём ведущего...</div>
      </div>
    );
  }

  return (
    <div className="join-page">
      <BackButton to="/" />
      <h1>Присоединиться</h1>
      {error && <div className="error">{error}</div>}

      {gameStatus && (
        <div className="join-lobby">
          <h2>{gameStatus.name}</h2>
          <p className="game-info-bar">
            {gameStatus.total_rounds} раундов &middot; {gameStatus.round_duration} сек на раунд
          </p>

          {/* Nickname is set globally via the prompt on first visit */}

          <section className="card">
            <h2>Выберите команду</h2>
            {gameStatus.teams.map((team) => (
              <div key={team.id} className="team-card" style={{ borderColor: team.color }}>
                <div className="team-header">
                  <span className="team-dot" style={{ background: team.color }} />
                  <strong>{team.name}</strong>
                  <span className="player-count">
                    {team.player_count} игрок{team.player_count === 1 ? '' : team.player_count < 5 ? 'а' : 'ов'}
                  </span>
                </div>
                {team.players.length > 0 && (
                  <ul className="player-list">
                    {team.players.map((p) => (
                      <li key={p.id}>
                        {p.nickname}
                        {p.is_captain && <span className="captain-badge"> (капитан)</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {!player && (
                  <button onClick={() => handleJoinTeam(team.id)}>Вступить</button>
                )}
                {player && player.team_id !== team.id && (
                  <button className="switch-btn" onClick={() => handleSwitchTeam(team.id)}>
                    Перейти сюда
                  </button>
                )}
                {player && player.team_id === team.id && (
                  <span className="your-team-badge">Ваша команда</span>
                )}
              </div>
            ))}
          </section>

          {player && (
            <div className="waiting-message">
              Ждём, пока ведущий начнёт игру...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

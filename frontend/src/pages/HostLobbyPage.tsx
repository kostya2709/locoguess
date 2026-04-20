import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, GAME_CODE } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { BackButton } from '../components/common/BackButton';
import type { GameStatusResponse } from '../api/client';

const TEAM_DEFAULTS = [
  { name: 'Красные', color: '#ef4444' },
  { name: 'Синие', color: '#3b82f6' },
  { name: 'Оранжевые', color: '#f97316' },
  { name: 'Фиолетовые', color: '#a855f7' },
  { name: 'Розовые', color: '#ec4899' },
  { name: 'Голубые', color: '#06b6d4' },
  { name: 'Бирюзовые', color: '#14b8a6' },
  { name: 'Серые', color: '#6b7280' },
];

/**
 * Host lobby page: configure teams & time, wait for players, assign captains, start.
 */
export function HostLobbyPage() {
  const navigate = useNavigate();
  const [gameStatus, setGameStatus] = useState<GameStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [noGame, setNoGame] = useState(false);

  // Editable settings
  const [teamCount, setTeamCount] = useState(4);
  const [teamCountStr, setTeamCountStr] = useState('4');
  const [teamNames, setTeamNames] = useState<string[]>(
    TEAM_DEFAULTS.slice(0, 4).map((t) => t.name),
  );
  const [roundDuration, setRoundDuration] = useState(60);
  const [roundDurationStr, setRoundDurationStr] = useState('60');
  const [streetViewEnabled, setStreetViewEnabled] = useState(false);
  const [musicHost, setMusicHost] = useState(true);
  const [musicGuests, setMusicGuests] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Mark this tab as host
  useEffect(() => {
    sessionStorage.setItem(`locoguess_role_${GAME_CODE}`, 'host');
  }, []);

  // Poll game status
  useEffect(() => {
    const poll = () =>
      api.getGameStatus(GAME_CODE)
        .then((s) => {
          setGameStatus(s);
          setNoGame(false);
          // Initialize editable settings from server on first load
          if (!settingsLoaded) {
            setTeamCount(s.teams.length);
            setTeamCountStr(String(s.teams.length));
            setTeamNames(s.teams.map((t) => t.name));
            setRoundDuration(s.round_duration);
            setRoundDurationStr(String(s.round_duration));
            setStreetViewEnabled(s.street_view_enabled);
            setMusicHost(s.music_host);
            setMusicGuests(s.music_guests);
            setSettingsLoaded(true);
          }
        })
        .catch(() => setNoGame(true));
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [settingsLoaded]);

  // WS for real-time updates
  useWebSocket({
    joinCode: GAME_CODE,
    sessionId: `host-${GAME_CODE}`,
    onMessage: useCallback(() => {
      api.getGameStatus(GAME_CODE).then(setGameStatus).catch(() => {});
    }, []),
  });

  function handleTeamCountChange(newCount: number) {
    const clamped = Math.max(1, Math.min(8, newCount));
    setTeamCount(clamped);
    setTeamNames((prev) => {
      const next = [...prev];
      while (next.length < clamped) {
        next.push(TEAM_DEFAULTS[next.length % TEAM_DEFAULTS.length].name);
      }
      return next.slice(0, clamped);
    });
  }

  function handleTeamNameChange(index: number, name: string) {
    setTeamNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }

  async function handleSaveSettings() {
    setError('');
    try {
      await api.updateGame(GAME_CODE, {
        team_count: teamCount,
        team_names: teamNames,
        round_duration: roundDuration,
        street_view_enabled: streetViewEnabled,
        music_host: musicHost,
        music_guests: musicGuests,
      });
      // Refresh status
      api.getGameStatus(GAME_CODE).then(setGameStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить настройки');
    }
  }

  async function handleStart() {
    // Save settings first, then start
    setError('');
    try {
      await api.updateGame(GAME_CODE, {
        team_count: teamCount,
        team_names: teamNames,
        round_duration: roundDuration,
        street_view_enabled: streetViewEnabled,
        music_host: musicHost,
        music_guests: musicGuests,
      });
      await api.startGame(GAME_CODE);
      navigate('/play');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось запустить игру');
    }
  }

  async function handleSetCaptain(teamId: string, playerId: string) {
    try {
      await api.setCaptain(GAME_CODE, teamId, playerId);
      api.getGameStatus(GAME_CODE).then(setGameStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось назначить капитана');
    }
  }

  if (noGame) {
    return (
      <div className="host-page">
        <BackButton to="/" />
        <h1>Запустить игру</h1>
        <div className="waiting-message">
          Игра ещё не создана. Сначала создайте игру.
        </div>
        <button className="start-btn" onClick={() => navigate('/host')}>
          Создать игру
        </button>
      </div>
    );
  }

  const canStart = gameStatus?.ready_to_start ?? false;
  const settingsChanged = gameStatus && (
    teamCount !== gameStatus.teams.length
    || teamNames.some((n, i) => gameStatus.teams[i]?.name !== n)
    || roundDuration !== gameStatus.round_duration
    || streetViewEnabled !== gameStatus.street_view_enabled
    || musicHost !== gameStatus.music_host
    || musicGuests !== gameStatus.music_guests
  );

  return (
    <div className="host-page">
      <BackButton to="/" />
      <h1>Запустить игру</h1>
      {error && <div className="error">{error}</div>}

      {gameStatus && (
        <div className="host-lobby">
          <div className="game-info-bar">
            <strong>{gameStatus.name}</strong> &mdash; {gameStatus.total_rounds} раундов
          </div>

          {/* Settings section */}
          <section className="card">
            <h2>Настройки</h2>
            <div className="settings-form">
              <label>
                Количество команд
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={teamCountStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTeamCountStr(v);
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n >= 1 && n <= 8) handleTeamCountChange(n);
                  }}
                  onBlur={() => {
                    const n = parseInt(teamCountStr, 10);
                    const clamped = isNaN(n) ? teamCount : Math.max(1, Math.min(8, n));
                    setTeamCountStr(String(clamped));
                    if (clamped !== teamCount) handleTeamCountChange(clamped);
                  }}
                />
              </label>
              <div className="team-names-config">
                {teamNames.map((name, i) => (
                  <div key={i} className="team-name-row">
                    <span
                      className="team-color-preview"
                      style={{ background: TEAM_DEFAULTS[i % TEAM_DEFAULTS.length].color }}
                    />
                    <input
                      type="text"
                      placeholder={`Команда ${i + 1}`}
                      maxLength={50}
                      value={name}
                      onChange={(e) => handleTeamNameChange(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <label>
                Время на раунд (секунды)
                <input
                  type="number"
                  min={10}
                  max={300}
                  step={10}
                  value={roundDurationStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRoundDurationStr(v);
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n >= 10 && n <= 300) setRoundDuration(n);
                  }}
                  onBlur={() => {
                    const n = parseInt(roundDurationStr, 10);
                    const clamped = isNaN(n) ? roundDuration : Math.max(10, Math.min(300, n));
                    setRoundDurationStr(String(clamped));
                    if (clamped !== roundDuration) setRoundDuration(clamped);
                  }}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={streetViewEnabled}
                  onChange={(e) => setStreetViewEnabled(e.target.checked)}
                />
                Street View (панорама на карте)
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={musicHost} onChange={(e) => setMusicHost(e.target.checked)} />
                Музыка для ведущего
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={musicGuests} onChange={(e) => setMusicGuests(e.target.checked)} />
                Музыка для игроков
              </label>
              {settingsChanged && (
                <button className="secondary-btn" onClick={handleSaveSettings}>
                  Сохранить настройки
                </button>
              )}
            </div>
          </section>

          {/* Players section */}
          <section className="card">
            <h2>Игроки</h2>
            {gameStatus.teams.map((team) => (
              <div key={team.id} className="team-card" style={{ borderColor: team.color }}>
                <div className="team-header">
                  <span className="team-dot" style={{ background: team.color }} />
                  <strong>{team.name}</strong>
                  <span className="player-count">
                    {team.player_count === 0
                      ? 'Ожидание...'
                      : `${team.player_count} игрок${team.player_count === 1 ? '' : team.player_count < 5 ? 'а' : 'ов'}`}
                  </span>
                </div>
                {team.players.length > 0 && (
                  <ul className="player-list">
                    {team.players.map((p) => (
                      <li key={p.id} className="player-item">
                        <span>
                          {p.nickname}
                          {p.is_captain && <span className="captain-badge"> (капитан)</span>}
                        </span>
                        {!p.is_captain && (
                          <button
                            className="captain-btn"
                            onClick={() => handleSetCaptain(team.id, p.id)}
                          >
                            Назначить капитаном
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>

          <button className="start-btn" onClick={handleStart} disabled={!canStart}>
            {canStart
              ? 'Начать игру'
              : 'Ждём, пока все команды наберут игроков...'}
          </button>
        </div>
      )}
    </div>
  );
}

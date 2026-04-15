import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scoreboard } from '../components/Results/Scoreboard';
import { BackButton } from '../components/common/BackButton';
import { api, GAME_CODE } from '../api/client';
import type { ScoreboardEntry } from '../types/game';

/**
 * Final results page showing the game scoreboard.
 */
export function ResultsPage() {
  const navigate = useNavigate();
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [error, setError] = useState('');

  const isHost = !!localStorage.getItem(`locoguess_host_${GAME_CODE}`)
    && sessionStorage.getItem(`locoguess_role_${GAME_CODE}`) !== 'player';

  useEffect(() => {
    api.getScoreboard(GAME_CODE).then(setScoreboard);
  }, []);

  async function handleReplayGame() {
    if (!window.confirm('Переиграть всю игру с начала? Все результаты будут сброшены.')) return;
    setError('');
    try {
      await api.replayGame(GAME_CODE);
      navigate('/play');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось переиграть игру');
    }
  }

  return (
    <div className="results-page">
      <BackButton to="/" label="На главную страницу" />
      <h1>Игра окончена!</h1>
      <Scoreboard entries={scoreboard} />
      {error && <div className="error">{error}</div>}
      <div className="results-buttons">
        {isHost ? (
          <>
            <button onClick={() => navigate('/')}>На главную страницу</button>
            <button className="replay-btn" onClick={handleReplayGame}>
              Переиграть всю игру
            </button>
          </>
        ) : (
          <button onClick={() => navigate('/join')}>Ждать следующую игру</button>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, GAME_CODE } from '../api/client';
import { BackButton } from '../components/common/BackButton';
import type { PackInfo } from '../api/client';

/**
 * Host setup page: pick a game pack from DB, create game, go to lobby.
 */
export function HostSetupPage() {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<PackInfo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPacks().then(setPacks);
  }, []);

  async function handleSelectPack(packId: string) {
    setError('');
    try {
      const pack = packs.find((p) => p.id === packId);
      const game = await api.createGame({
        name: pack?.name || 'Новая игра',
        pack_id: packId,
        team_count: 2,
        round_duration: 60,
      });
      localStorage.setItem(`locoguess_host_${GAME_CODE}`, game.host_secret);
      sessionStorage.setItem(`locoguess_role_${GAME_CODE}`, 'host');
      navigate('/lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать игру');
    }
  }

  return (
    <div className="host-page">
      <BackButton to="/" />
      <h1>Начать игру</h1>
      {error && <div className="error">{error}</div>}

      <h2>Выберите набор</h2>
      {packs.length === 0 && (
        <div className="waiting-message">
          Наборов пока нет. Создайте набор в разделе «Наборы».
        </div>
      )}
      <div className="pack-grid">
        {packs.map((pack) => (
          <button
            key={pack.id}
            className="pack-card"
            onClick={() => handleSelectPack(pack.id)}
            disabled={pack.round_count === 0}
          >
            <strong>{pack.name}</strong>
            <span>{pack.description}</span>
            <span className="pack-rounds">
              {pack.round_count > 0 ? `${pack.round_count} раундов` : 'Нет раундов'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

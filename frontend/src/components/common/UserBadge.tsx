import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getTabNickname, setTabNickname } from '../../App';
import { api, GAME_CODE } from '../../api/client';
import type { Player } from '../../types/game';

/**
 * Displays the current tab's nickname in the top-right corner.
 * Click to edit (disabled during gameplay).
 */
export function UserBadge() {
  const [nickname, setNickname] = useState(() => getTabNickname());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname);
  const [error, setError] = useState('');
  const location = useLocation();

  const isInGame = location.pathname === '/play' || location.pathname === '/results';

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === nickname) {
      setEditing(false);
      return;
    }
    const saved = sessionStorage.getItem(`locoguess_session_${GAME_CODE}`)
      || localStorage.getItem(`locoguess_session_${GAME_CODE}`);
    if (saved) {
      try {
        const p = JSON.parse(saved) as Player;
        const updated = await api.renamePlayer(GAME_CODE, p.session_id, trimmed);
        sessionStorage.setItem(`locoguess_session_${GAME_CODE}`, JSON.stringify(updated));
        localStorage.setItem(`locoguess_session_${GAME_CODE}`, JSON.stringify(updated));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось переименовать');
        return;
      }
    }
    setTabNickname(trimmed);
    setNickname(trimmed);
    setError('');
    setEditing(false);
  }

  if (editing && !isInGame) {
    return (
      <div className="user-badge">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="user-badge-edit">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={30}
            autoFocus
            onBlur={handleSave}
          />
          <button type="submit">OK</button>
        </form>
        {error && <div className="user-badge-error">{error}</div>}
      </div>
    );
  }

  return (
    <div
      className={`user-badge ${isInGame ? 'user-badge-readonly' : ''}`}
      onClick={!isInGame ? () => { setDraft(nickname); setEditing(true); } : undefined}
      title={isInGame ? nickname : 'Нажмите, чтобы изменить'}
    >
      {nickname}
    </div>
  );
}

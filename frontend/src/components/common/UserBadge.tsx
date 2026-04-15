import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getTabNickname, setTabNickname } from '../../App';

/**
 * Displays the current tab's nickname in the top-right corner.
 * Click to edit (disabled during gameplay).
 */
export function UserBadge() {
  const [nickname, setNickname] = useState(() => getTabNickname());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname);
  const location = useLocation();

  const isInGame = location.pathname === '/play' || location.pathname === '/results';

  function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setTabNickname(trimmed);
    setNickname(trimmed);
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

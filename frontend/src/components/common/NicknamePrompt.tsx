import { useState } from 'react';

interface Props {
  onSave: (nickname: string) => void;
}

/**
 * Full-screen prompt shown on first visit (per tab) to set a nickname.
 */
export function NicknamePrompt({ onSave }: Props) {
  const [draft, setDraft] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <div className="nickname-prompt-overlay">
      <div className="nickname-prompt">
        <h2>Как вас зовут?</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Ваш никнейм"
            maxLength={30}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={!draft.trim()}>
            Продолжить
          </button>
        </form>
      </div>
    </div>
  );
}

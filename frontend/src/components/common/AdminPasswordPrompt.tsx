import { useState, type FormEvent } from 'react';
import { api, setAdminToken } from '../../api/client';

interface Props {
  title: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Small modal that asks for the admin password. On success, saves the
 * returned token to localStorage and calls onSuccess. Used to gate the
 * "Начать игру" / "Наборы" buttons on the home page.
 */
export function AdminPasswordPrompt({ title, onSuccess, onCancel }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { token } = await api.verifyAdmin(password);
      setAdminToken(token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setBusy(false);
    }
  }

  return (
    <div className="admin-prompt-overlay" onClick={onCancel}>
      <div className="admin-prompt" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>Введите пароль, чтобы продолжить</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            inputMode="numeric"
          />
          {error && <div className="admin-prompt-error">{error}</div>}
          <div className="admin-prompt-actions">
            <button type="button" onClick={onCancel}>Отмена</button>
            <button type="submit" disabled={busy || !password.trim()}>
              {busy ? '...' : 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

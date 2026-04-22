import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPasswordPrompt } from '../components/common/AdminPasswordPrompt';
import { getAdminToken } from '../api/client';
import weddingLogo from '../assets/wedding-logo.png';

/**
 * Landing page with three options: start game, join, marketplace.
 * "Начать игру" and "Наборы" require the admin password; the token is
 * cached in localStorage so a device only has to enter it once.
 */
export function HomePage() {
  const navigate = useNavigate();
  const [promptTarget, setPromptTarget] = useState<null | { title: string; path: string }>(null);

  function goAdmin(title: string, path: string) {
    if (getAdminToken()) {
      navigate(path);
    } else {
      setPromptTarget({ title, path });
    }
  }

  return (
    <div className="home-page">
      <img src={weddingLogo} alt="" className="wedding-logo-hero" />
      <h1>LocoGuess</h1>
      <p className="subtitle">Угадай место по фото</p>
      <div className="home-buttons">
        <button className="big-btn create-btn" onClick={() => goAdmin('Начать игру', '/host')}>
          Начать игру
        </button>
        <button className="big-btn join-btn" onClick={() => navigate('/join')}>
          Присоединиться
        </button>
        <button className="big-btn marketplace-btn" onClick={() => goAdmin('Наборы', '/marketplace')}>
          Наборы
        </button>
      </div>
      {promptTarget && (
        <AdminPasswordPrompt
          title={promptTarget.title}
          onSuccess={() => navigate(promptTarget.path)}
          onCancel={() => setPromptTarget(null)}
        />
      )}
    </div>
  );
}

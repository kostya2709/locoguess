import { useNavigate } from 'react-router-dom';

/**
 * Landing page with three options: start game, join, marketplace.
 */
export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <h1>LocoGuess</h1>
      <p className="subtitle">Угадай место по фото</p>
      <div className="home-buttons">
        <button className="big-btn create-btn" onClick={() => navigate('/host')}>
          Начать игру
        </button>
        <button className="big-btn join-btn" onClick={() => navigate('/join')}>
          Присоединиться
        </button>
        <button className="big-btn marketplace-btn" onClick={() => navigate('/marketplace')}>
          Наборы
        </button>
      </div>
    </div>
  );
}

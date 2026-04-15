import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { HostSetupPage } from './pages/HostSetupPage';
import { HostLobbyPage } from './pages/HostLobbyPage';
import { JoinPage } from './pages/JoinPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { GamePage } from './pages/GamePage';
import { ResultsPage } from './pages/ResultsPage';
import { NicknamePrompt } from './components/common/NicknamePrompt';
import { UserBadge } from './components/common/UserBadge';
import { useServerRestart } from './hooks/useServerRestart';
import './App.css';

/** Wrapper that runs the server restart check inside the router context. */
function ServerRestartGuard({ children }: { children: React.ReactNode }) {
  useServerRestart();
  return <>{children}</>;
}

/** Get the nickname for this tab: sessionStorage (per-tab) → localStorage (shared default). */
export function getTabNickname(): string {
  return sessionStorage.getItem('locoguess_nickname') || localStorage.getItem('locoguess_nickname') || '';
}

/** Save nickname for this tab and as the default for new tabs. */
export function setTabNickname(name: string) {
  sessionStorage.setItem('locoguess_nickname', name);
  localStorage.setItem('locoguess_nickname', name);
}

export default function App() {
  const [hasNickname, setHasNickname] = useState(() => !!getTabNickname());

  if (!hasNickname) {
    return (
      <div className="app">
        <NicknamePrompt onSave={(name) => { setTabNickname(name); setHasNickname(true); }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ServerRestartGuard>
      <div className="app">
        <UserBadge />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/host" element={<HostSetupPage />} />
          <Route path="/lobby" element={<HostLobbyPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/play" element={<GamePage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </div>
      </ServerRestartGuard>
    </BrowserRouter>
  );
}
